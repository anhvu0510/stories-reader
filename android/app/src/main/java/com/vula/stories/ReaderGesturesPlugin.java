package com.vula.stories;

import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import org.json.JSONException;
import android.util.Log;
import java.util.LinkedHashMap;

/** Android owns gesture recognition; React owns content, geometry and actions. */
@CapacitorPlugin(name = "ReaderGestures")
public class ReaderGesturesPlugin extends Plugin implements ReaderWebView.GestureDelegate {
    private ReaderWebView webView;
    private ReaderGestureSession session;
    private ProgressBar indicator;
    private final RectF handle = new RectF();
    private float controlScale = 1;
    private float controlOffset;
    private float controlMinimum;
    private float controlMaximum;
    private float dragStartOffset;
    private boolean refreshEnabled;
    private boolean armed;
    private String refreshOwner = "";
    private String requestId = "";
    private int requestSequence;
    private String swipeOwner = "";
    private String sheetOwner = "";
    private boolean swipeEnabled;
    private boolean sheetEnabled;
    private float swipeThreshold = 120;
    private float swipeVelocity = 0.35f;
    private long swipeMaxDuration;
    private float edgeIgnoreWidth = 28;
    private boolean surfaceDragging;
    private boolean touching;
    private final LinkedHashMap<String, Boolean> sheetOwners = new LinkedHashMap<>();

    @Override
    public void load() {
        getActivity().runOnUiThread(this::attach);
    }

    private void attach() {
        if (!(getBridge().getWebView() instanceof ReaderWebView)) return;
        webView = (ReaderWebView) getBridge().getWebView();
        float density = getContext().getResources().getDisplayMetrics().density;
        session = new ReaderGestureSession(ViewConfiguration.get(getContext()).getScaledTouchSlop(), 65 * density);
        session.setCssScale(density);
        webView.setGestureDelegate(this);
        indicator = new ProgressBar(getContext());
        indicator.setContentDescription("Đang tải lại nội dung");
        indicator.setVisibility(View.GONE);
        indicator.setClickable(false);
        indicator.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        ViewGroup parent = (ViewGroup) webView.getParent();
        parent.addView(indicator, new ViewGroup.LayoutParams((int) (36 * density), (int) (36 * density)));
    }

    @PluginMethod
    public void configureControl(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (webView == null) { call.reject("ReaderWebView unavailable"); return; }
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            if (!enabled) { handle.setEmpty(); resetGestureOwnership(); call.resolve(); return; }
            float width = number(call, "viewportWidth", 0);
            if (width <= 0) { call.reject("Invalid viewport width"); return; }
            controlScale = webView.getWidth() / width;
            handle.set(number(call, "left", 0) * controlScale, number(call, "top", 0) * controlScale,
                    number(call, "right", 0) * controlScale, number(call, "bottom", 0) * controlScale);
            controlOffset = number(call, "offset", 0);
            controlMinimum = number(call, "minimum", 0);
            controlMaximum = number(call, "maximum", 0);
            call.resolve();
        });
    }

    private float number(PluginCall call, String key, double fallback) {
        Double value = call.getDouble(key, fallback);
        return value == null || !Double.isFinite(value) ? (float) fallback : value.floatValue();
    }

    @PluginMethod
    public void configureRefresh(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (session == null) { call.reject("ReaderWebView unavailable"); return; }
            String owner = call.getString("owner", "");
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            if (!enabled && !refreshOwner.equals(owner)) { call.resolve(); return; }
            resetGestureOwnership();
            refreshOwner = owner;
            refreshEnabled = enabled;
            requestId = "";
            session.completeRefresh();
            float density = getContext().getResources().getDisplayMetrics().density;
            session.setThreshold(number(call, "threshold", 65) * density);
            showIndicator(0);
            call.resolve();
        });
    }

    @PluginMethod
    public void finishRefresh(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (session == null) { call.reject("ReaderWebView unavailable"); return; }
            if (!refreshOwner.equals(call.getString("owner")) || !requestId.equals(call.getString("requestId"))) {
                call.resolve(); return;
            }
            session.completeRefresh();
            requestId = "";
            showIndicator(0);
            call.resolve();
        });
    }

    @PluginMethod
    public void configureSwipe(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (session == null) { call.reject("ReaderWebView unavailable"); return; }
            String owner = call.getString("owner", "");
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            if (!enabled && !swipeOwner.equals(owner)) { call.resolve(); return; }
            resetGestureOwnership();
            swipeOwner = owner;
            swipeEnabled = enabled;
            swipeThreshold = number(call, "threshold", 120);
            swipeVelocity = number(call, "minVelocity", 0.35);
            swipeMaxDuration = (long) number(call, "maxDuration", 0);
            edgeIgnoreWidth = number(call, "edgeIgnoreWidth", 28);
            call.resolve();
        });
    }

    @PluginMethod
    public void configureSheet(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (session == null) { call.reject("ReaderWebView unavailable"); return; }
            String owner = call.getString("owner", "");
            boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
            resetGestureOwnership();
            sheetOwners.remove(owner);
            if (enabled) sheetOwners.put(owner, true);
            sheetEnabled = !sheetOwners.isEmpty();
            sheetOwner = "";
            for (String activeOwner : sheetOwners.keySet()) sheetOwner = activeOwner;
            call.resolve();
        });
    }

    @Override
    public boolean onTouch(MotionEvent event) {
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) return begin(event);
        if (action == MotionEvent.ACTION_MOVE) return move(event);
        if (action == MotionEvent.ACTION_POINTER_DOWN) { resetGestureOwnership(); return false; }
        if (action != MotionEvent.ACTION_UP && action != MotionEvent.ACTION_CANCEL) return false;
        boolean owned = session.isOwned();
        settleSurface(event.getEventTime() - event.getDownTime(), action == MotionEvent.ACTION_CANCEL);
        boolean refresh = session.finish(action == MotionEvent.ACTION_CANCEL);
        if (touching) emit("interaction-end", new JSObject());
        touching = false;
        if (refresh) commitRefresh();
        if (!session.isRefreshing()) showIndicator(0);
        return owned;
    }

    private boolean begin(MotionEvent event) {
        touching = true;
        boolean control = handle.contains(event.getX(), event.getY());
        int token = session.begin(event.getX(), event.getY(), control);
        dragStartOffset = controlOffset;
        armed = false;
        surfaceDragging = false;
        emit("interaction-start", new JSObject());
        if (control) return true;
        float density = getContext().getResources().getDisplayMetrics().density;
        if (!refreshEnabled && !swipeEnabled && !sheetEnabled) return false;
        if (event.getX() < edgeIgnoreWidth * density || event.getX() > webView.getWidth() - edgeIgnoreWidth * density) return false;
        // Hit-test DOM scroll owners and selection once, never on every MOVE.
        // Late results cannot take over a gesture already handed to Chromium.
        String script = "window.__storiesNativeGestureHitTest && window.__storiesNativeGestureHitTest("
                + event.getX() / density + "," + event.getY() / density + "," + JSONObject.quote(refreshOwner)
                + "," + JSONObject.quote(swipeOwner) + "," + JSONObject.quote(sheetOwner) + ")";
        webView.evaluateJavascript(script, result -> acceptEligibility(token, result));
        return false;
    }

    private void acceptEligibility(int token, String result) {
        if (result == null || !result.startsWith("{")) return;
        try {
            JSONObject data = new JSONObject(result);
            session.allowGestures(token, refreshEnabled && data.optBoolean("refresh"),
                    swipeEnabled && data.optBoolean("swipe"), sheetEnabled && data.optBoolean("sheet"));
        } catch (JSONException error) {
            Log.e("ReaderGestures", "Invalid DOM eligibility result", error);
        }
    }

    private boolean move(MotionEvent event) {
        if (!session.isOwned()
                && event.getEventTime() - event.getDownTime() >= ViewConfiguration.getLongPressTimeout()) {
            session.abandon(); return false;
        }
        boolean owned = session.move(event.getX(), event.getY(), event.getPointerCount());
        if (session.isControl()) { moveControl(); return owned; }
        if (session.isSwipe() || session.isSheet()) { moveSurface(); return owned; }
        if (!session.isPulling()) return owned;
        showIndicator(session.getPullDistance());
        if (session.isArmed() && !armed) webView.performHapticFeedback(android.view.HapticFeedbackConstants.CONTEXT_CLICK);
        armed = session.isArmed();
        return owned;
    }

    private void moveSurface() {
        surfaceDragging = true;
        float density = getContext().getResources().getDisplayMetrics().density;
        JSObject data = new JSObject();
        data.put("offset", session.isSwipe() ? session.getDeltaX() / density : Math.max(0, session.getDeltaY() / density));
        data.put("owner", sheetOwner);
        emit(session.isSwipe() ? "swipe-move" : "sheet-move", data);
    }

    private void settleSurface(long elapsed, boolean cancelled) {
        if (!surfaceDragging) return;
        surfaceDragging = false;
        float density = getContext().getResources().getDisplayMetrics().density;
        if (session.isSheet()) {
            JSObject data = new JSObject();
            data.put("owner", sheetOwner);
            data.put("dismiss", session.sheetResult(cancelled, elapsed, density));
            emit("sheet-end", data);
            return;
        }
        JSObject data = new JSObject();
        data.put("settled", session.swipeResult(cancelled, elapsed, swipeThreshold * density, swipeVelocity * density, swipeMaxDuration));
        emit("swipe-end", data);
    }

    private void moveControl() {
        float next = Math.max(controlMinimum, Math.min(controlMaximum, dragStartOffset + session.getDeltaY() / controlScale));
        float delta = (next - controlOffset) * controlScale;
        controlOffset = next;
        handle.offset(0, delta);
        JSObject data = new JSObject();
        data.put("offset", next);
        emit("control-move", data);
    }

    private void commitRefresh() {
        requestId = refreshOwner + ":" + (++requestSequence);
        JSObject data = new JSObject();
        data.put("requestId", requestId);
        emit("refresh", data);
        showIndicator(1);
    }

    private void emit(String kind, JSObject detail) {
        detail.put("kind", kind);
        JSObject data = new JSObject();
        data.put("detail", detail);
        getBridge().triggerWindowJSEvent("stories-reader-native-gesture", data.toString());
    }

    private void showIndicator(float distance) {
        if (indicator == null) return;
        float density = getContext().getResources().getDisplayMetrics().density;
        boolean visible = distance > 0 || session.isRefreshing();
        indicator.setVisibility(visible ? View.VISIBLE : View.GONE);
        indicator.setX(webView.getX() + (webView.getWidth() - indicator.getLayoutParams().width) / 2f);
        indicator.setY(webView.getY() + 48 * density + Math.min(48 * density, distance));
        indicator.setAlpha(session.isRefreshing() ? 1 : Math.min(1, distance / (65 * density)));
    }

    private void cancelGesture() {
        resetGestureOwnership();
        if (touching) emit("interaction-end", new JSObject());
        touching = false;
    }

    /** Configuration changes cancel recognition, not the physical DOWN → UP stream. */
    private void resetGestureOwnership() {
        if (session == null) return;
        settleSurface(0, true);
        session.finish(true);
        if (!session.isRefreshing()) showIndicator(0);
    }

    @Override
    protected void handleOnPause() { getActivity().runOnUiThread(this::cancelGesture); }

    @Override
    protected void handleOnDestroy() {
        getActivity().runOnUiThread(() -> {
            cancelGesture();
            if (webView != null) webView.setGestureDelegate(null);
            if (indicator != null && indicator.getParent() instanceof ViewGroup) ((ViewGroup) indicator.getParent()).removeView(indicator);
            webView = null;
            indicator = null;
        });
    }
}
