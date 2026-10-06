package com.vula.stories;

import org.junit.Test;
import static org.junit.Assert.*;

public class ReaderGestureSessionTest {
    @Test public void sheetHasPriorityOverRefreshAndRejectsHorizontalMotion() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(100, 100, false);
        session.allowGestures(token, true, true, true);
        assertTrue(session.move(105, 210, 1));
        assertTrue(session.isSheet());
        assertFalse(session.isPulling());
        assertFalse(session.finish(false));
        token = session.begin(100, 100, false);
        session.allowGestures(token, false, false, true);
        assertFalse(session.move(200, 110, 1));
    }

    @Test public void chapterSwipeLocksOneDirectionAndCancelCannotNavigate() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(200, 100, false);
        session.allowGestures(token, true, true, false);
        assertTrue(session.move(70, 105, 1));
        assertTrue(session.isSwipe());
        assertEquals(-130, session.getDeltaX(), 0.01);
        assertEquals("left", session.swipeResult(false, 300, 120, 0.45f, 0));
        assertEquals("cancel", session.swipeResult(true, 300, 120, 0.45f, 0));
        assertFalse(session.finish(true));
        token = session.begin(200, 100, false);
        session.allowGestures(token, false, true, false);
        assertFalse(session.move(210, 200, 1));
        assertFalse(session.move(70, 200, 1));
    }
    @Test public void cancellationNeverRefreshesAndReversalDisarms() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertTrue(session.move(100, 280, 1));
        assertTrue(session.isArmed());
        assertFalse(session.finish(true));
        token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        session.move(100, 280, 1);
        session.move(100, 100, 1);
        assertFalse(session.isArmed());
        assertFalse(session.finish(false));
    }

    @Test public void controlDragNeverRefreshesAndSupportsBothDirections() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(20, 500, true);
        session.allowRefresh(token, true);
        assertTrue(session.move(100, 400, 1));
        assertEquals(-100, session.getDeltaY(), 0.01);
        assertTrue(session.isControl());
        session.move(20, 600, 1);
        assertEquals(100, session.getDeltaY(), 0.01);
        assertFalse(session.finish(false));
    }

    @Test public void horizontalMultiTouchAndLateEligibilityDoNotStealWebView() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertFalse(session.move(160, 110, 1));
        assertFalse(session.move(160, 300, 1));
        assertFalse(session.finish(false));
        token = session.begin(100, 100, false);
        session.allowRefresh(token - 1, true);
        assertFalse(session.move(100, 300, 1));
        session.allowRefresh(token, true);
        assertFalse(session.move(100, 400, 1));
        assertFalse(session.finish(false));
        token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertFalse(session.move(100, 300, 2));
        assertFalse(session.finish(false));
    }

    @Test public void refreshIsSingleFlightAndOnlyAReleaseCanCommit() {
        ReaderGestureSession session = new ReaderGestureSession(8, 65);
        int token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertTrue(session.move(100, 280, 1));
        assertTrue(session.finish(false));
        token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertFalse(session.move(100, 280, 1));
        assertFalse(session.finish(false));
        session.completeRefresh();
        token = session.begin(100, 100, false);
        session.allowRefresh(token, true);
        assertTrue(session.move(100, 280, 1));
        assertTrue(session.finish(false));
    }
}
