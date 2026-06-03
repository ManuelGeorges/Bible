import { doc, getDoc, updateDoc, increment, arrayUnion, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { StorageService, KEYS } from "./storage";

export const syncLocalDataToFirebase = async (user) => {
    if (!user || !db) return;

    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        const localStats = await StorageService.getLocalStats();
        const localCompletedPlans = await StorageService.get('local_completed_plans') || {};
        const localCustomPlans = await StorageService.get('local_custom_plans') || {};
        const localHistory = await StorageService.get('points_history') || [];
        const localAnswered = await StorageService.get('answered_questions') || {};
        const localBadges = await StorageService.get('local_badges') || [];
        const localLastActive = await StorageService.get(KEYS.LAST_ACTIVE);
        const localChapters = await StorageService.get(KEYS.COMPLETED_CHAPTERS) || {};
        const localMapPoints = await StorageService.get('visited_map_points') || [];
        const localQuizzes = await StorageService.get('completed_quizzes') || [];
        const localLastRead = await StorageService.get(KEYS.LAST_READ);

        const updates = {};

        // 1. مزامنة النقاط
        if (localStats.points > 0) {
            updates.totalPoints = increment(localStats.points);
            updates.pointsHistory = arrayUnion({
                type: 'sync_merge',
                points: localStats.points,
                reason: 'دمج النقاط من الجهاز المحلي',
                timestamp: new Date().toISOString()
            });
        }

        // 2. مزامنة سجل النقاط
        if (localHistory.length > 0) {
            if (!updates.pointsHistory) updates.pointsHistory = arrayUnion(...localHistory);
            else {
                updates.pointsHistory = arrayUnion({
                    type: 'sync_merge',
                    points: localStats.points,
                    reason: 'دمج النقاط من الجهاز المحلي',
                    timestamp: new Date().toISOString()
                }, ...localHistory);
            }
        }

        // 3. مزامنة الأسئلة المجابة
        const answeredKeys = Object.keys(localAnswered);
        if (answeredKeys.length > 0) {
            answeredKeys.forEach(key => {
                updates[`answeredQuestions.${key}`] = localAnswered[key];
            });
        }

        // 4. مزامنة الملاحظات
        const unSyncedNotes = localStats.notes.filter(n => !n.synced);
        if (unSyncedNotes.length > 0) {
            updates.notes = arrayUnion(...unSyncedNotes.map(n => ({ ...n, synced: true })));
        }

        // 5. مزامنة المفضلات
        const localFavKeys = Object.keys(localStats.favorites);
        if (localFavKeys.length > 0) {
            for (const key of localFavKeys) {
                if (!localStats.favorites[key].synced) {
                    updates[`favorites.verses.${key}`] = { ...localStats.favorites[key], synced: true };
                }
            }
        }

        // 6. مزامنة الخطط والأصحاحات
        Object.keys(localCompletedPlans).forEach(planId => {
            updates[`completedPlans.${planId}`] = localCompletedPlans[planId];
        });
        Object.keys(localCustomPlans).forEach(planId => {
            updates[`customPlans.${planId}`] = localCustomPlans[planId];
        });
        Object.keys(localChapters).forEach(chId => {
            updates[`completedChapters.${chId}`] = localChapters[chId];
        });

        // 7. الأوسمة والخريطة والمسابقات وآخر قراءة
        if (localBadges.length > 0) {
            updates.badges = arrayUnion(...localBadges);
        }
        if (localMapPoints.length > 0) {
            updates.visitedMapPoints = arrayUnion(...localMapPoints);
        }
        if (localQuizzes.length > 0) {
            updates.completedQuizzes = arrayUnion(...localQuizzes);
        }
        if (localLastRead) {
            updates.lastRead = localLastRead;
        }
        if (localLastActive) {
            updates.lastActiveDate = localLastActive;
        }

        // تنفيذ التحديثات
        if (Object.keys(updates).length > 0) {
            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    uid: user.uid,
                    displayName: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString(),
                    ...updates
                });
            } else {
                await updateDoc(userRef, updates);
            }

            // تنظيف التخزين المحلي بعد التأكد من المزامنة
            await StorageService.save(KEYS.POINTS, 0);
            await StorageService.save('points_history', []);
            await StorageService.save('answered_questions', {});
            await StorageService.save('local_completed_plans', {});
            await StorageService.save('local_custom_plans', {});
            await StorageService.save('local_badges', []);
            await StorageService.save(KEYS.COMPLETED_CHAPTERS, {});
            await StorageService.save('visited_map_points', []);
            await StorageService.save('completed_quizzes', []);

            // تحديث الملاحظات والمفضلات لتكون معلمة كمزامنة
            await StorageService.save(KEYS.NOTES, localStats.notes.map(n => ({ ...n, synced: true })));
            const updatedFavs = { ...localStats.favorites };
            Object.keys(updatedFavs).forEach(k => updatedFavs[k].synced = true);
            await StorageService.save(KEYS.FAVORITES, updatedFavs);
        }

        console.log("Sync: All data merged successfully");
    } catch (error) {
        console.error("Sync Error:", error);
    }
};
