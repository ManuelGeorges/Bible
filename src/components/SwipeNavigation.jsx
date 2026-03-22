"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from '@capacitor/core';

const SwipeNavigation = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [isNative, setIsNative] = useState(false);

  // قائمة المسارات مرتبة حسب الأيقونات اللي في الصورة (من اليمين للشمال مثلاً)
  // [المنيو، البحث، الهوم، الكتاب، الخريطة]
  const tabs = ["/maps", "/bible", "/", "/search", "/more"];
  const currentIndex = tabs.indexOf(pathname);

  useEffect(() => {
    // التأكد إننا على موبايل (Android/iOS) مش متصفح
    if (Capacitor.isNativePlatform()) {
      setIsNative(true);
    }
  }, []);

  const onDragEnd = (event, info) => {
    // لو مش على الموبايل، اخرج ومتحركش
    if (!isNative) return;

    const swipeThreshold = 100; // مسافة السحبة بالبيكسل
    const velocityThreshold = 500; // سرعة السحبة

    // سحب لليمين (الرجوع للخلف في الترتيب)
    if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
      if (currentIndex > 0) {
        router.push(tabs[currentIndex - 1]);
      }
    } 
    // سحب للشمال (التقدم في الترتيب)
    else if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
      if (currentIndex < tabs.length - 1 && currentIndex !== -1) {
        router.push(tabs[currentIndex + 1]);
      }
    }
  };

  // لو مش موبايل، اعرض المحتوى عادي من غير حركات السحب
  if (!isNative) return <>{children}</>;

  return (
    <motion.div
      key={pathname}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1} // مقاومة بسيطة عشان الصفحة متبعدش عن الصباع
      onDragEnd={onDragEnd}
      // touch-pan-y بتسمح للمستخدم يعمل scroll لفوق ولتحت عادي من غير ما السحب يمين وشمال يعطله
      style={{ touchAction: "pan-y", width: "100%", minHeight: "100vh" }}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

export default SwipeNavigation;