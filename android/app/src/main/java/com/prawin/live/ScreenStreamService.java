package com.prawin.live;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.pedro.common.ConnectChecker;
import com.pedro.encoder.input.sources.audio.AudioSource;
import com.pedro.encoder.input.sources.audio.InternalAudioSource;
import com.pedro.encoder.input.sources.audio.MicrophoneSource;
import com.pedro.encoder.input.sources.video.NoVideoSource;
import com.pedro.encoder.input.sources.video.ScreenSource;
import com.pedro.library.generic.GenericStream;

public class ScreenStreamService extends Service implements ConnectChecker {

    public static final String ACTION_START = "com.prawin.live.action.START_SCREEN_STREAM";
    public static final String ACTION_STOP = "com.prawin.live.action.STOP_SCREEN_STREAM";
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_PROJECTION_DATA = "projectionData";
    public static final String EXTRA_ENDPOINT = "endpoint";
    public static final String EXTRA_AUDIO_MODE = "audioMode";
    public static final String EXTRA_WIDTH = "width";
    public static final String EXTRA_HEIGHT = "height";
    public static final String EXTRA_BITRATE = "bitrate";

    private static final String CHANNEL_ID = "screen_stream";
    private static final int NOTIFICATION_ID = 7304;
    private static final String TAG = "ScreenStreamService";

    private GenericStream stream;
    private MediaProjection projection;
    private boolean stopped;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || ACTION_STOP.equals(intent.getAction())) {
            stopBroadcast("stopped", "Broadcast ended.");
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction())) return START_NOT_STICKY;

        startForegroundNotification();
        try {
            startBroadcast(intent);
        } catch (Exception error) {
            Log.e(TAG, "Unable to start screen stream", error);
            stopBroadcast("error", error.getMessage());
        }
        return START_NOT_STICKY;
    }

    private void startBroadcast(Intent intent) {
        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0);
        Intent projectionData = intent.getParcelableExtra(EXTRA_PROJECTION_DATA);
        if (projectionData == null) throw new IllegalArgumentException("Screen capture data is missing.");

        MediaProjectionManager manager = (MediaProjectionManager) getSystemService(MEDIA_PROJECTION_SERVICE);
        projection = manager.getMediaProjection(resultCode, projectionData);
        if (projection == null) throw new IllegalStateException("Android did not grant screen capture.");
        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                stopBroadcast("stopped", "Screen sharing was stopped by Android.");
            }
        }, new Handler(getMainLooper()));

        String audioMode = intent.getStringExtra(EXTRA_AUDIO_MODE);
        AudioSource audioSource;
        if ("microphone".equals(audioMode)) {
            audioSource = new MicrophoneSource();
        } else {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
                throw new IllegalArgumentException("Device audio capture requires Android 10 or newer. Select microphone audio instead.");
            }
            audioSource = new InternalAudioSource(projection, null);
        }

        int width = intent.getIntExtra(EXTRA_WIDTH, 720);
        int height = intent.getIntExtra(EXTRA_HEIGHT, 1280);
        int bitrate = intent.getIntExtra(EXTRA_BITRATE, 2500000);
        stream = new GenericStream(this, this, new NoVideoSource(), audioSource);
        stream.getGlInterface().setForceRender(true, 15);
        if (!stream.prepareVideo(width, height, bitrate, 30, 2, 0)) {
            throw new IllegalStateException("This device cannot prepare the selected video resolution.");
        }
        if (!stream.prepareAudio(44100, true, 128000)) {
            throw new IllegalStateException("This device cannot prepare the selected audio source.");
        }

        stream.changeVideoSource(new ScreenSource(this, projection));
        stream.startStream(intent.getStringExtra(EXTRA_ENDPOINT));
        stopped = false;
        ScreenStreamPlugin.emitStatus("connecting", "Connecting to the selected platform...");
    }

    private void startForegroundNotification() {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setContentTitle("PRAWIN Live screen broadcast")
            .setContentText("Your screen is being shared")
            .setOngoing(true)
            .addAction(0, "Stop", createStopPendingIntent())
            .build();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private PendingIntent createStopPendingIntent() {
        Intent stopIntent = new Intent(this, ScreenStreamService.class).setAction(ACTION_STOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, 1, stopIntent, flags);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "Screen broadcasts", NotificationManager.IMPORTANCE_LOW);
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(channel);
    }

    private void stopBroadcast(String state, String message) {
        if (stopped) return;
        stopped = true;
        if (stream != null) {
            try {
                if (stream.isStreaming()) stream.stopStream();
                stream.release();
            } catch (Exception error) {
                Log.w(TAG, "Error while releasing stream", error);
            }
            stream = null;
        }
        if (projection != null) {
            projection.stop();
            projection = null;
        }
        stopForeground(true);
        stopSelf();
        ScreenStreamPlugin.emitStatus(state, message);
    }

    @Override
    public void onDestroy() {
        stopBroadcast("stopped", "Broadcast ended.");
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onConnectionStarted(String url) {
        ScreenStreamPlugin.emitStatus("connecting", "Connecting to the streaming server...");
    }

    @Override
    public void onConnectionSuccess() {
        ScreenStreamPlugin.emitStatus("live", "Your screen is live.");
    }

    @Override
    public void onNewBitrate(long bitrate) {
        ScreenStreamPlugin.emitStatus("live", "Streaming at " + (bitrate / 1000) + " kbps.");
    }

    @Override
    public void onConnectionFailed(String reason) {
        ScreenStreamPlugin.emitStatus("error", reason);
        stopBroadcast("error", reason);
    }

    @Override
    public void onDisconnect() {
        ScreenStreamPlugin.emitStatus("stopped", "Streaming disconnected.");
    }

    @Override
    public void onAuthError() {
        stopBroadcast("error", "The server rejected the stream key.");
    }

    @Override
    public void onAuthSuccess() {
        ScreenStreamPlugin.emitStatus("live", "Streaming server accepted the stream key.");
    }
}