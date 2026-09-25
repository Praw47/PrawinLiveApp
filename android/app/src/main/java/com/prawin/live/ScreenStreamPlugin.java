package com.prawin.live;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.projection.MediaProjectionManager;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;

@CapacitorPlugin(
    name = "ScreenStreamer",
    permissions = {@Permission(alias = "microphone", strings = {Manifest.permission.RECORD_AUDIO})}
)
public class ScreenStreamPlugin extends Plugin {

    private static WeakReference<ScreenStreamPlugin> currentPlugin = new WeakReference<>(null);

    @Override
    public void load() {
        currentPlugin = new WeakReference<>(this);
    }

    @PluginMethod
    public void startStream(PluginCall call) {
        String endpoint = call.getString("endpoint", "").trim();
        String audioMode = call.getString("audioMode", "device");
        int width = call.getInt("width", 720);
        int height = call.getInt("height", 1280);
        int bitrate = call.getInt("bitrate", 2500000);

        if (!(endpoint.startsWith("rtmp://") || endpoint.startsWith("rtmps://"))) {
            call.reject("Enter a valid RTMP or RTMPS server URL and stream key.");
            return;
        }
        if (width < 2 || height < 2 || width % 2 != 0 || height % 2 != 0) {
            call.reject("The stream resolution must use positive even dimensions.");
            return;
        }
        if ("microphone".equals(audioMode)
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionResult");
            return;
        }
        requestScreenCapture(call);
    }

    @PermissionCallback
    private void microphonePermissionResult(PluginCall call) {
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED) {
            call.reject("Microphone permission was not granted.");
            return;
        }
        requestScreenCapture(call);
    }

    private void requestScreenCapture(PluginCall call) {
        MediaProjectionManager manager = (MediaProjectionManager) getContext()
            .getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        startActivityForResult(call, manager.createScreenCaptureIntent(), "screenCaptureResult");
    }

    @ActivityCallback
    private void screenCaptureResult(PluginCall call, ActivityResult result) {
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            call.reject("Screen capture permission was not granted.");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), ScreenStreamService.class)
            .setAction(ScreenStreamService.ACTION_START)
            .putExtra(ScreenStreamService.EXTRA_RESULT_CODE, result.getResultCode())
            .putExtra(ScreenStreamService.EXTRA_PROJECTION_DATA, data)
            .putExtra(ScreenStreamService.EXTRA_ENDPOINT, call.getString("endpoint", ""))
            .putExtra(ScreenStreamService.EXTRA_AUDIO_MODE, call.getString("audioMode", "device"))
            .putExtra(ScreenStreamService.EXTRA_WIDTH, call.getInt("width", 720))
            .putExtra(ScreenStreamService.EXTRA_HEIGHT, call.getInt("height", 1280))
            .putExtra(ScreenStreamService.EXTRA_BITRATE, call.getInt("bitrate", 2500000));
        ContextCompat.startForegroundService(getContext(), serviceIntent);
        call.resolve();
    }

    @PluginMethod
    public void stopStream(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), ScreenStreamService.class)
            .setAction(ScreenStreamService.ACTION_STOP);
        getContext().startService(serviceIntent);
        call.resolve();
    }

    static void emitStatus(String state, String message) {
        ScreenStreamPlugin plugin = currentPlugin.get();
        if (plugin == null) return;
        JSObject event = new JSObject();
        event.put("state", state);
        event.put("message", message == null ? "" : message);
        plugin.notifyListeners("broadcastStatus", event);
    }
}