package com.masterlab.diagnostics;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (FirebaseApp.getApps(this).isEmpty()) {
            String projectId = getString(R.string.firebase_project_id);
            String appId = getString(R.string.firebase_app_id);
            String apiKey = getString(R.string.firebase_api_key);
            if (!projectId.isEmpty() && !appId.isEmpty() && !apiKey.isEmpty()) {
                FirebaseOptions.Builder builder = new FirebaseOptions.Builder()
                    .setProjectId(projectId)
                    .setApplicationId(appId)
                    .setApiKey(apiKey);
                String senderId = getString(R.string.firebase_sender_id);
                if (!senderId.isEmpty()) {
                    builder.setGcmSenderId(senderId);
                }
                String storageBucket = getString(R.string.firebase_storage_bucket);
                if (!storageBucket.isEmpty()) {
                    builder.setStorageBucket(storageBucket);
                }
                FirebaseApp.initializeApp(this, builder.build());
            }
        }
        super.onCreate(savedInstanceState);
    }
}
