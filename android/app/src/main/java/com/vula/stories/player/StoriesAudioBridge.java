package com.vula.stories.player;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.content.ContextCompat;

/**
 * Cầu nối giao tiếp hai chiều giữa các Plugin phát âm thanh (EdgeTTS / NativeTTS)
 * và Foreground Service điều khiển âm thanh trên thanh thông báo / màn hình khóa (StoriesAudioService).
 */
public class StoriesAudioBridge {
    private static final String TAG = "StoriesAudioBridge";

    /**
     * Interface nhận các sự kiện điều khiển từ thanh thông báo hoặc màn hình khóa hoặc tai nghe Bluetooth.
     */
    public interface AudioControlListener {
        /** Người dùng bấm nút Tiếp tục phát (Play) */
        void onPlayRequested();

        /** Người dùng bấm nút Tạm dừng (Pause) */
        void onPauseRequested();

        /** Người dùng bấm nút Chuyển câu tiếp theo (Next) */
        void onNextRequested();

        /** Người dùng bấm nút Lùi câu trước đó (Previous) */
        void onPreviousRequested();

        /** Người dùng bấm nút Đóng/Dừng hẳn trình phát (Stop) */
        void onStopRequested();
    }

    private static volatile AudioControlListener activeListener = null;

    /**
     * Đăng ký đối tượng lắng nghe điều khiển từ thanh thông báo.
     * Khi plugin bắt đầu phát một chương truyện, nó sẽ đăng ký chính nó vào đây.
     */
    public static synchronized void registerListener(AudioControlListener listener) {
        activeListener = listener;
        Log.d(TAG, "Đã đăng ký AudioControlListener: " + (listener != null ? listener.getClass().getSimpleName() : "null"));
    }

    /**
     * Hủy đăng ký lắng nghe khi plugin dừng hẳn luồng phát.
     */
    public static synchronized void unregisterListener(AudioControlListener listener) {
        if (activeListener == listener) {
            activeListener = null;
            Log.d(TAG, "Đã hủy đăng ký AudioControlListener");
        }
    }

    /**
     * Chuyển tiếp lệnh Play tới plugin đang hoạt động.
     */
    public static void dispatchPlay() {
        AudioControlListener listener = activeListener;
        if (listener != null) {
            listener.onPlayRequested();
        }
    }

    /**
     * Chuyển tiếp lệnh Pause tới plugin đang hoạt động.
     */
    public static void dispatchPause() {
        AudioControlListener listener = activeListener;
        if (listener != null) {
            listener.onPauseRequested();
        }
    }

    /**
     * Chuyển tiếp lệnh Next tới plugin đang hoạt động.
     */
    public static void dispatchNext() {
        AudioControlListener listener = activeListener;
        if (listener != null) {
            listener.onNextRequested();
        }
    }

    /**
     * Chuyển tiếp lệnh Previous tới plugin đang hoạt động.
     */
    public static void dispatchPrevious() {
        AudioControlListener listener = activeListener;
        if (listener != null) {
            listener.onPreviousRequested();
        }
    }

    /**
     * Chuyển tiếp lệnh Stop tới plugin đang hoạt động.
     */
    public static void dispatchStop() {
        AudioControlListener listener = activeListener;
        if (listener != null) {
            listener.onStopRequested();
        }
    }

    /**
     * Gửi yêu cầu cập nhật thông tin bài phát và trạng thái lên StoriesAudioService
     * để hiển thị trên thanh thông báo hệ thống và màn hình khóa.
     *
     * @param context Ngữ cảnh ứng dụng
     * @param bookTitle Tên sách / truyện
     * @param chapterTitle Tên chương truyện đang đọc
     * @param currentText Nội dung câu văn hiện tại đang được đọc
     * @param isPlaying Trạng thái đang phát hay đang tạm dừng
     * @param hasPrev Còn câu trước đó để tua lại không
     * @param hasNext Còn câu tiếp theo để chuyển tới không
     */
    public static void updatePlayback(
            Context context,
            String bookTitle,
            String chapterTitle,
            String currentText,
            boolean isPlaying,
            boolean hasPrev,
            boolean hasNext
    ) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, StoriesAudioService.class);
            intent.setAction(StoriesAudioService.ACTION_UPDATE_PLAYBACK);
            intent.putExtra(StoriesAudioService.EXTRA_BOOK_TITLE, bookTitle != null ? bookTitle : "Stories Reader");
            intent.putExtra(StoriesAudioService.EXTRA_CHAPTER_TITLE, chapterTitle != null ? chapterTitle : "Chương đọc");
            intent.putExtra(StoriesAudioService.EXTRA_CURRENT_TEXT, currentText != null ? currentText : "");
            intent.putExtra(StoriesAudioService.EXTRA_IS_PLAYING, isPlaying);
            intent.putExtra(StoriesAudioService.EXTRA_HAS_PREV, hasPrev);
            intent.putExtra(StoriesAudioService.EXTRA_HAS_NEXT, hasNext);

            // Bắt đầu Foreground Service an toàn trên mọi phiên bản Android
            ContextCompat.startForegroundService(context, intent);
        } catch (Exception ex) {
            Log.e(TAG, "Lỗi khi gửi cập nhật playback tới StoriesAudioService: " + ex.getMessage(), ex);
        }
    }

    /**
     * Gửi yêu cầu dừng và tắt hoàn toàn thanh điều khiển notification.
     *
     * @param context Ngữ cảnh ứng dụng
     */
    public static void stopPlayback(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, StoriesAudioService.class);
            intent.setAction(StoriesAudioService.ACTION_STOP_SERVICE);
            context.startService(intent);
        } catch (Exception ex) {
            Log.e(TAG, "Lỗi khi yêu cầu dừng StoriesAudioService: " + ex.getMessage(), ex);
        }
    }
}
