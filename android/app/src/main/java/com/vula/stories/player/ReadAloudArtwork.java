package com.vula.stories.player;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import androidx.core.content.ContextCompat;
import com.vula.stories.R;
import java.io.ByteArrayOutputStream;

/** Shared, locally bundled artwork for device TTS, legacy Edge and Media3. */
public final class ReadAloudArtwork {
    private static final int SIZE = 512;
    private static Bitmap bitmap;
    private static byte[] png;

    private ReadAloudArtwork() {}

    public static synchronized Bitmap getBitmap(Context context) {
        if (bitmap != null) return bitmap;
        Drawable logo = ContextCompat.getDrawable(context, R.mipmap.ic_launcher);
        if (logo == null) throw new IllegalStateException("Read aloud logo resource is missing");
        Bitmap artwork = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        logo.setBounds(0, 0, SIZE, SIZE);
        logo.draw(new Canvas(artwork));
        bitmap = artwork;
        return bitmap;
    }

    public static synchronized byte[] getPng(Context context) {
        if (png != null) return png;
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        boolean encoded = getBitmap(context).compress(Bitmap.CompressFormat.PNG, 100, output);
        if (!encoded) throw new IllegalStateException("Could not encode read aloud artwork");
        png = output.toByteArray();
        return png;
    }
}
