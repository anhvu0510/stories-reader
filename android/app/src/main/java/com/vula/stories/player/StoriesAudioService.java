package com.vula.stories.player;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.vula.stories.MainActivity;
import com.vula.stories.R;

/**
 * Foreground Service chuyên biệt cho việc phát âm thanh đọc sách nền.
 * Quản lý MediaSessionCompat và hiển thị thanh điều khiển chuẩn NotificationCompat.MediaStyle
 * trên thanh thông báo hệ thống và màn hình khóa (Lock Screen).
 */
public class StoriesAudioService extends Service {
    private static final String TAG = "StoriesAudioService";

    public static final String CHANNEL_ID = "stories_audio_playback_channel";
    public static final int NOTIFICATION_ID = 1001;

    // Các Intent Action được sử dụng để điều khiển
    public static final String ACTION_UPDATE_PLAYBACK = "com.vula.stories.ACTION_UPDATE_PLAYBACK";
    public static final String ACTION_STOP_SERVICE = "com.vula.stories.ACTION_STOP_SERVICE";
    public static final String ACTION_PLAY = "com.vula.stories.ACTION_PLAY";
    public static final String ACTION_PAUSE = "com.vula.stories.ACTION_PAUSE";
    public static final String ACTION_NEXT = "com.vula.stories.ACTION_NEXT";
    public static final String ACTION_PREV = "com.vula.stories.ACTION_PREV";
    public static final String ACTION_STOP = "com.vula.stories.ACTION_STOP";

    // Các Extras nạp dữ liệu
    public static final String EXTRA_BOOK_TITLE = "bookTitle";
    public static final String EXTRA_CHAPTER_TITLE = "chapterTitle";
    public static final String EXTRA_CURRENT_TEXT = "currentText";
    public static final String EXTRA_IS_PLAYING = "isPlaying";
    public static final String EXTRA_HAS_PREV = "hasPrev";
    public static final String EXTRA_HAS_NEXT = "hasNext";

    private MediaSessionCompat mediaSession;
    private NotificationManager notificationManager;

    private String lastBookTitle = "Stories Reader";
    private String lastChapterTitle = "Chương đọc";
    private String lastCurrentText = "";
    private boolean lastIsPlaying = false;
    private boolean lastHasPrev = false;
    private boolean lastHasNext = false;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createNotificationChannel();
        initMediaSession();
        Log.i(TAG, "StoriesAudioService đã được khởi tạo thành công");
    }

    /**
     * Khởi tạo kênh thông báo (Notification Channel) với mức ưu tiên LOW
     * để khi chuyển câu đọc không phát ra âm thanh chuông hay rung gây khó chịu cho người đọc.
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Trình phát âm thanh đọc sách",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Hiển thị thanh điều khiển phát âm thanh trên màn hình khóa và thông báo");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Khởi tạo MediaSessionCompat và đăng ký Callback lắng nghe các lệnh điều khiển từ hệ điều hành,
     * màn hình khóa, thanh thông báo hoặc tai nghe Bluetooth.
     */
    private void initMediaSession() {
        mediaSession = new MediaSessionCompat(this, "StoriesMediaSession");
        mediaSession.setFlags(
                MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
                MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.d(TAG, "MediaSession: onPlay received");
                StoriesAudioBridge.dispatchPlay();
            }

            @Override
            public void onPause() {
                Log.d(TAG, "MediaSession: onPause received");
                StoriesAudioBridge.dispatchPause();
            }

            @Override
            public void onSkipToNext() {
                Log.d(TAG, "MediaSession: onSkipToNext received");
                StoriesAudioBridge.dispatchNext();
            }

            @Override
            public void onSkipToPrevious() {
                Log.d(TAG, "MediaSession: onSkipToPrevious received");
                StoriesAudioBridge.dispatchPrevious();
            }

            @Override
            public void onStop() {
                Log.d(TAG, "MediaSession: onStop received");
                StoriesAudioBridge.dispatchStop();
                stopPlaybackService();
            }
        });

        mediaSession.setActive(true);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        switch (action) {
            case ACTION_UPDATE_PLAYBACK:
                lastBookTitle = intent.getStringExtra(EXTRA_BOOK_TITLE);
                if (lastBookTitle == null || lastBookTitle.isEmpty()) lastBookTitle = "Stories Reader";

                lastChapterTitle = intent.getStringExtra(EXTRA_CHAPTER_TITLE);
                if (lastChapterTitle == null || lastChapterTitle.isEmpty()) lastChapterTitle = "Chương đọc";

                lastCurrentText = intent.getStringExtra(EXTRA_CURRENT_TEXT);
                if (lastCurrentText == null) lastCurrentText = "";

                lastIsPlaying = intent.getBooleanExtra(EXTRA_IS_PLAYING, true);
                lastHasPrev = intent.getBooleanExtra(EXTRA_HAS_PREV, false);
                lastHasNext = intent.getBooleanExtra(EXTRA_HAS_NEXT, true);

                renderNotification();
                break;

            case ACTION_PLAY:
                StoriesAudioBridge.dispatchPlay();
                break;

            case ACTION_PAUSE:
                StoriesAudioBridge.dispatchPause();
                break;

            case ACTION_NEXT:
                StoriesAudioBridge.dispatchNext();
                break;

            case ACTION_PREV:
                StoriesAudioBridge.dispatchPrevious();
                break;

            case ACTION_STOP:
                StoriesAudioBridge.dispatchStop();
                stopPlaybackService();
                break;

            case ACTION_STOP_SERVICE:
                stopPlaybackService();
                break;

            default:
                break;
        }

        return START_NOT_STICKY;
    }

    /**
     * Cập nhật MediaMetadata, PlaybackStateCompat và xuất bản Notification ra thanh thông báo.
     */
    private void renderNotification() {
        if (mediaSession == null) return;

        // 1. Cập nhật PlaybackState
        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP;
        if (lastHasPrev) actions |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        if (lastHasNext) actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;

        int state = lastIsPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
                .setActions(actions)
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                .build();
        mediaSession.setPlaybackState(playbackState);

        // 2. Cập nhật MediaMetadata
        MediaMetadataCompat metadata = new MediaMetadataCompat.Builder()
                .putString(MediaMetadataCompat.METADATA_KEY_TITLE, lastChapterTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, lastBookTitle)
                .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, lastCurrentText)
                .build();
        mediaSession.setMetadata(metadata);

        // 3. Khởi tạo PendingIntent khi người dùng chạm vào nội dung thông báo (mở lại app)
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent(this, MainActivity.class);
        }
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentPendingIntent = PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );

        // 4. Khởi tạo các PendingIntent cho từng nút điều khiển
        int intentFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0);

        Intent prevIntent = new Intent(this, StoriesAudioService.class).setAction(ACTION_PREV);
        PendingIntent prevPendingIntent = PendingIntent.getService(this, 1, prevIntent, intentFlags);

        Intent playPauseIntent = new Intent(this, StoriesAudioService.class).setAction(lastIsPlaying ? ACTION_PAUSE : ACTION_PLAY);
        PendingIntent playPausePendingIntent = PendingIntent.getService(this, 2, playPauseIntent, intentFlags);

        Intent nextIntent = new Intent(this, StoriesAudioService.class).setAction(ACTION_NEXT);
        PendingIntent nextPendingIntent = PendingIntent.getService(this, 3, nextIntent, intentFlags);

        Intent stopIntent = new Intent(this, StoriesAudioService.class).setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(this, 4, stopIntent, intentFlags);

        // 5. Cấu hình MediaStyle cho Notification
        androidx.media.app.NotificationCompat.MediaStyle mediaStyle = new androidx.media.app.NotificationCompat.MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2) // Hiển thị Prev, Play/Pause, Next ở dạng thu gọn
                .setShowCancelButton(true)
                .setCancelButtonIntent(stopPendingIntent);

        // 6. Xây dựng thông báo với NotificationCompat.Builder
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(lastChapterTitle)
                .setContentText(lastCurrentText != null && !lastCurrentText.isEmpty() ? lastCurrentText : "Đang phát...")
                .setSubText(lastBookTitle)
                .setContentIntent(contentPendingIntent)
                .setDeleteIntent(stopPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC) // Hiển thị đầy đủ trên Lock Screen
                .setOnlyAlertOnce(true)
                .setOngoing(lastIsPlaying)
                .setStyle(mediaStyle);

        // Thêm nút Lùi (Previous)
        builder.addAction(android.R.drawable.ic_media_previous, "Lùi", prevPendingIntent);

        // Thêm nút Play / Pause tùy theo trạng thái
        int playPauseIcon = lastIsPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        String playPauseLabel = lastIsPlaying ? "Tạm dừng" : "Tiếp tục";
        builder.addAction(playPauseIcon, playPauseLabel, playPausePendingIntent);

        // Thêm nút Tiếp (Next)
        builder.addAction(android.R.drawable.ic_media_next, "Tiếp", nextPendingIntent);

        // Thêm nút Dừng (Stop)
        builder.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Đóng", stopPendingIntent);

        // 7. Khởi động / duy trì Foreground Service
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, builder.build());
            }
        } catch (Exception ex) {
            Log.e(TAG, "Lỗi khi gọi startForeground: " + ex.getMessage(), ex);
        }
    }

    /**
     * Dừng Foreground Service và đóng thông báo hoàn toàn.
     */
    private void stopPlaybackService() {
        Log.i(TAG, "Đang dừng StoriesAudioService và thu hồi Notification...");
        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
            } catch (Exception ignored) {}
        }
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } else {
                stopForeground(true);
            }
        } catch (Exception ignored) {}
        stopSelf();
    }

    @Override
    public void onDestroy() {
        Log.i(TAG, "StoriesAudioService bị hủy (onDestroy)");
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
