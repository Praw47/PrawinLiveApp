import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const peerConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

function addRemoteCandidates(peer, values, seen) {
  if (!peer.remoteDescription) return Promise.resolve()

  return values.reduce((pending, value) => pending.then(async () => {
    if (seen.has(value.candidate)) return
    await peer.addIceCandidate(value)
    seen.add(value.candidate)
  }), Promise.resolve())
}

export function publishLiveStream({ db, streamId, mediaStream, onViewerCount, onError }) {
  const connections = new Map()
  let closed = false

  const closeConnection = (viewerId) => {
    const connection = connections.get(viewerId)
    if (!connection) return
    connection.stopWatching?.()
    connection.peer.close()
    connections.delete(viewerId)
  }

  const stopWatchingViewers = onSnapshot(
    collection(db, 'liveStreams', streamId, 'viewers'),
    (snapshot) => {
      onViewerCount(snapshot.size)
      snapshot.docChanges().forEach((change) => {
        const viewerId = change.doc.id
        if (change.type === 'removed') {
          closeConnection(viewerId)
          return
        }
        if (change.type !== 'added' || connections.has(viewerId) || closed) return

        const viewerRef = change.doc.ref
        const peer = new RTCPeerConnection(peerConfiguration)
        const connection = { peer, viewerRef, stopWatching: null, seenCandidates: new Set() }
        connections.set(viewerId, connection)
        mediaStream.getTracks().forEach((track) => peer.addTrack(track, mediaStream))
        peer.onicecandidate = (event) => {
          if (event.candidate) {
            updateDoc(viewerRef, { hostCandidates: arrayUnion(event.candidate.toJSON()) }).catch(onError)
          }
        }

        let updates = Promise.resolve()
        connection.stopWatching = onSnapshot(viewerRef, (viewerSnapshot) => {
          updates = updates.then(async () => {
            const data = viewerSnapshot.data()
            if (!data) return
            if (data.answer && !peer.remoteDescription) {
              await peer.setRemoteDescription(data.answer)
            }
            await addRemoteCandidates(peer, data.viewerCandidates || [], connection.seenCandidates)
          }).catch(onError)
        }, onError)

        ;(async () => {
          const offer = await peer.createOffer()
          await peer.setLocalDescription(offer)
          await updateDoc(viewerRef, {
            offer: { type: offer.type, sdp: offer.sdp },
            state: 'offered',
          })
        })().catch(onError)
      })
    },
    onError,
  )

  return async () => {
    closed = true
    stopWatchingViewers()
    const activeConnections = [...connections.values()]
    activeConnections.forEach((connection) => {
      connection.stopWatching?.()
      connection.peer.close()
    })
    connections.clear()
    await Promise.all(activeConnections.map((connection) => deleteDoc(connection.viewerRef).catch(() => {})))
  }
}

export async function watchLiveStream({ db, streamId, userId, videoElement, onState, onError }) {
  const viewerRef = doc(collection(db, 'liveStreams', streamId, 'viewers'))
  const peer = new RTCPeerConnection(peerConfiguration)
  const seenCandidates = new Set()
  let stopped = false
  let updates = Promise.resolve()

  peer.addTransceiver('video', { direction: 'recvonly' })
  peer.addTransceiver('audio', { direction: 'recvonly' })
  peer.ontrack = (event) => {
    videoElement.srcObject = event.streams[0]
    videoElement.play().catch(() => {})
    onState('live')
  }
  peer.onconnectionstatechange = () => {
    if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
      onState('reconnecting')
    }
  }
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      updateDoc(viewerRef, { viewerCandidates: arrayUnion(event.candidate.toJSON()) }).catch(onError)
    }
  }

  await setDoc(viewerRef, {
    viewerUid: userId,
    state: 'waiting',
    viewerCandidates: [],
  })

  const stopWatching = onSnapshot(viewerRef, (snapshot) => {
    updates = updates.then(async () => {
      const data = snapshot.data()
      if (!data) return
      if (data.offer && !peer.remoteDescription) {
        await peer.setRemoteDescription(data.offer)
        const answer = await peer.createAnswer()
        await peer.setLocalDescription(answer)
        await updateDoc(viewerRef, {
          answer: { type: answer.type, sdp: answer.sdp },
          state: 'connected',
        })
        onState('connecting')
      }
      await addRemoteCandidates(peer, data.hostCandidates || [], seenCandidates)
    }).catch(onError)
  }, onError)

  return () => {
    if (stopped) return
    stopped = true
    stopWatching()
    peer.close()
    videoElement.srcObject = null
    deleteDoc(viewerRef).catch(onError)
  }
}