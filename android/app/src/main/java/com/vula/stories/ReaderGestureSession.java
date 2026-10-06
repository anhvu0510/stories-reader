package com.vula.stories;

/** Single owner for a touch stream. Pure Java so Android gesture policy is testable. */
public final class ReaderGestureSession {
    private enum Owner { TRACKING, CONTROL, REFRESH, SWIPE, SHEET, WEB }
    private final float slop;
    private float threshold;
    private Owner owner = Owner.WEB;
    private float startX;
    private float startY;
    private float deltaY;
    private float deltaX;
    private int token;
    private boolean eligible;
    private boolean refreshing;
    private boolean swipeEligible;
    private boolean sheetEligible;
    private float cssScale = 1;

    public ReaderGestureSession(float slop, float threshold) {
        this.slop = slop;
        this.threshold = threshold;
    }

    public int begin(float x, float y, boolean control) {
        token++;
        startX = x;
        startY = y;
        deltaY = 0;
        deltaX = 0;
        eligible = false;
        swipeEligible = false;
        sheetEligible = false;
        owner = control ? Owner.CONTROL : Owner.TRACKING;
        return token;
    }

    public void allowRefresh(int expectedToken, boolean allowed) {
        if (token != expectedToken || owner != Owner.TRACKING) return;
        eligible = allowed && !refreshing;
    }

    public void allowGestures(int expectedToken, boolean refresh, boolean swipe, boolean sheet) {
        if (token != expectedToken || owner != Owner.TRACKING) return;
        eligible = refresh && !refreshing && !sheet;
        swipeEligible = swipe && !sheet;
        sheetEligible = sheet;
    }

    public boolean move(float x, float y, int pointers) {
        if (pointers != 1) return abandon();
        deltaY = y - startY;
        deltaX = x - startX;
        if (owner == Owner.CONTROL || owner == Owner.REFRESH || owner == Owner.SWIPE || owner == Owner.SHEET) return true;
        if (owner != Owner.TRACKING) return false;
        float absX = Math.abs(deltaX);
        if (Math.max(absX, Math.abs(deltaY)) <= slop) return false;
        if (swipeEligible && absX > Math.abs(deltaY) * 1.3f) { owner = Owner.SWIPE; return true; }
        if (sheetEligible && deltaY > slop && deltaY > absX * 1.2f) { owner = Owner.SHEET; return true; }
        if (!eligible || deltaY <= slop || deltaY <= absX * 1.2f) return abandon();
        owner = Owner.REFRESH;
        return true;
    }

    public boolean abandon() {
        owner = Owner.WEB;
        eligible = false;
        deltaY = 0;
        deltaX = 0;
        return false;
    }

    public boolean finish(boolean cancelled) {
        boolean commit = !cancelled && isArmed() && !refreshing;
        refreshing = refreshing || commit;
        abandon();
        token++;
        return commit;
    }

    public void completeRefresh() { refreshing = false; }
    public void setThreshold(float value) { threshold = Math.max(slop, value); }
    public void setCssScale(float scale) { cssScale = Math.max(1, scale); }
    public boolean isRefreshing() { return refreshing; }
    public boolean isControl() { return owner == Owner.CONTROL; }
    public boolean isSwipe() { return owner == Owner.SWIPE; }
    public boolean isSheet() { return owner == Owner.SHEET; }
    public boolean isOwned() { return isControl() || isPulling() || isSwipe() || isSheet(); }
    public boolean isPulling() { return owner == Owner.REFRESH; }
    public boolean isArmed() { return isPulling() && getPullDistance() >= threshold; }
    public float getDeltaY() { return deltaY; }
    public float getDeltaX() { return deltaX; }
    public float getPullDistance() { return Math.max(0, deltaY * 0.5f); }

    public String swipeResult(boolean cancelled, long elapsed, float distance, float velocity, long maxDuration) {
        if (cancelled || !isSwipe() || (maxDuration > 0 && elapsed > maxDuration)) return "cancel";
        float absX = Math.abs(deltaX);
        boolean enough = absX >= distance || (absX >= Math.min(distance * 0.5f, 30 * cssScale) && absX / Math.max(1, elapsed) >= velocity);
        if (!enough || absX <= Math.abs(deltaY) * 1.3f) return "cancel";
        return deltaX < 0 ? "left" : "right";
    }

    public boolean sheetResult(boolean cancelled, long elapsed, float scale) {
        if (cancelled || !isSheet()) return false;
        float distance = Math.max(0, deltaY / scale);
        return distance > 90 || (distance >= 70 && distance / Math.max(1, elapsed) > 0.5f);
    }
}
