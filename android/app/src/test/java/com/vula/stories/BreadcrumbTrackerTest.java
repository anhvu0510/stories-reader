package com.vula.stories;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import com.vula.stories.logging.BreadcrumbTracker;

import org.json.JSONArray;
import org.junit.Before;
import org.junit.Test;

/**
 * Unit Test kiểm tra bộ nhớ đệm vết hoạt động (BreadcrumbTracker):
 * - Không lưu trữ chuỗi rỗng / null.
 * - Giới hạn kích thước vòng lặp tối đa 30 mục (Circular Ring-Buffer).
 * - Tự động xóa các mục cũ nhất khi vượt quá giới hạn.
 * - Hỗ trợ làm sạch bộ nhớ khi cần.
 */
public class BreadcrumbTrackerTest {

    @Before
    public void setUp() {
        BreadcrumbTracker.clear();
    }

    @Test
    public void testThemChuoiRongHoacNull_khongLuuVaoDanhSach() {
        BreadcrumbTracker.add("TestTag", null);
        BreadcrumbTracker.add("TestTag", "");
        BreadcrumbTracker.add("TestTag", "   ");

        JSONArray breadcrumbs = BreadcrumbTracker.getBreadcrumbsAsJson();
        assertNotNull(breadcrumbs);
        assertEquals(0, breadcrumbs.length());
    }

    @Test
    public void testThemBreadcrumbHopLe_luuDungDinhDangVaTag() {
        BreadcrumbTracker.add("EdgeTTS", "Bắt đầu tải câu 1");

        JSONArray breadcrumbs = BreadcrumbTracker.getBreadcrumbsAsJson();
        assertEquals(1, breadcrumbs.length());

        String item = breadcrumbs.optString(0);
        assertTrue("Mục phải chứa tag EdgeTTS", item.contains("[EdgeTTS]"));
        assertTrue("Mục phải chứa nội dung log", item.contains("Bắt đầu tải câu 1"));
    }

    @Test
    public void testGioiHanToiDa30Muc_xoaCacMucCuNhat() {
        // Thêm liên tục 40 mục vào bộ nhớ đệm
        for (int i = 1; i <= 40; i++) {
            BreadcrumbTracker.add("Step", "Hành động số " + i);
        }

        JSONArray breadcrumbs = BreadcrumbTracker.getBreadcrumbsAsJson();
        // Kích thước tối đa không được vượt quá 30
        assertEquals(30, breadcrumbs.length());

        // Mục đầu tiên phải là mục số 11 (do các mục 1 đến 10 đã bị đẩy ra ngoài)
        String firstItem = breadcrumbs.optString(0);
        assertTrue("Mục cũ nhất còn lại phải là mục 11", firstItem.contains("Hành động số 11"));

        // Mục cuối cùng phải là mục số 40
        String lastItem = breadcrumbs.optString(29);
        assertTrue("Mục mới nhất phải là mục 40", lastItem.contains("Hành động số 40"));
    }

    @Test
    public void testClear_lamSachDanhSach() {
        BreadcrumbTracker.add("Tag", "Msg 1");
        BreadcrumbTracker.add("Tag", "Msg 2");
        assertEquals(2, BreadcrumbTracker.getBreadcrumbsAsJson().length());

        BreadcrumbTracker.clear();
        assertEquals(0, BreadcrumbTracker.getBreadcrumbsAsJson().length());
    }
}
