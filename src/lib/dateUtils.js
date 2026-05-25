/**
 * توحيد التعامل مع التوقيت ليكون دائماً بتوقيت القاهرة
 */

export const getCairoDateInfo = (date = new Date()) => {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Cairo',
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: false
        });
        const parts = formatter.formatToParts(date);
        const getPart = (type) => parseInt(parts.find(p => p.type === type)?.value);

        const year = getPart('year');
        const month = getPart('month');
        const day = getPart('day');
        const hour = getPart('hour');
        const minute = getPart('minute');
        const second = getPart('second');

        return {
            year,
            month,
            day,
            hour,
            minute,
            second,
            key: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
            fullIso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}.000Z`
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

export const getCairoDate = (date = new Date()) => getCairoDateInfo(date).key;

export const getCairoIsoString = (date = new Date()) => getCairoDateInfo(date).fullIso;

export const getCairoYesterday = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    return getCairoDate(yesterday);
};
