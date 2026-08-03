/**
 * التعامل مع التوقيت ليكون حسب توقيت المستخدم المحلي
 */

export const getCairoDateInfo = (date = new Date()) => {
    try {
        // نستخدم التوقيت المحلي للمستخدم بدلاً من توقيت القاهرة
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const hour = date.getHours();
        const minute = date.getMinutes();
        const second = date.getSeconds();

        return {
            year,
            month,
            day,
            hour,
            minute,
            second,
            key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            fullIso: date.toISOString()
        };
    } catch (e) {
        // Fallback
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
            fullIso: date.toISOString()
        };
    }
};

// ملاحظة: حافظنا على أسماء الدوال كما هي لتجنب كسر الكود في باقي الملفات،
// ولكن المنطق أصبح يعتمد على التوقيت المحلي للمستخدم.

export const getCairoDate = (date = new Date()) => getCairoDateInfo(date).key;

export const getCairoIsoString = (date = new Date()) => getCairoDateInfo(date).fullIso;

export const getCairoYesterday = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return getCairoDate(yesterday);
};
