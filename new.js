match /sharedPlans/{planId} {
  // أي حد يقدر يشوف الخطط المشاركة
  allow read: if true;
  
  // أي حد (زائر أو مسجل) يقدر يضيف خطة جديدة للمشاركة
  allow create: if true;
  
  // الحذف فقط لصاحب الخطة (لو كان مسجل)
  allow delete: if request.auth != null && resource.data.authorId == request.auth.uid;
}