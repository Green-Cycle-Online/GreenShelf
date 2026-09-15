import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// English is the source of truth; Arabic mirrors every key. Keys are typed so a
// typo in a screen fails `tsc` instead of rendering "undefined". Layout
// direction (RTL) is a native setting in React Native: it is applied via
// I18nManager and takes effect on the next launch, so the provider also exposes
// `needsRestart` for the profile screen to explain that.

export type Lang = 'en' | 'ar';

const STORAGE_KEY = 'gs-lang';

const en = {
  'tabs.browse': 'Browse',
  'tabs.saved': 'Saved',
  'tabs.list': 'List',
  'tabs.wanted': 'Wanted',
  'tabs.profile': 'Profile',

  'browse.tagline': 'Free school books, passed on between families in Oman.',
  'browse.taglineReading': 'Story books, novels and more, passed on for free.',
  'browse.search': 'Search titles or subjects',
  'browse.searchReading': 'Search titles or genres',
  'browse.filters': 'Filters',
  'browse.clearAll': 'Clear all',
  'browse.oneBook': '1 book',
  'browse.nBooks': '{n} books',
  'browse.noMatchTitle': 'No books match',
  'browse.noMatchMsg': 'Try widening your search or filters, or be the first to list this one.',
  'browse.clearFilters': 'Clear filters',
  'browse.listABook': 'List a book',
  'browse.emptyTitle': 'No books yet',
  'browse.emptyMsg': 'GreenShelf is brand new. Be the first family in Oman to pass a book on. It takes under a minute.',
  'browse.notifyMe': 'Notify me',
  'browse.notifyHint': 'Get told when a book matching these filters is posted.',
  'browse.alertSaved': 'Saved. We will tell you when a matching book is posted.',
  'browse.signInForAlerts': 'Sign in to get notified about new books.',
  'browse.shared': '{n} books passed on so far',
  'browse.notifications': 'Notifications',

  'category.school': 'School books',
  'category.reading': 'Reading books',

  'filters.title': 'Filters',
  'filters.grade': 'Grade',
  'filters.age': 'Age',
  'filters.subject': 'Subject',
  'filters.genre': 'Genre',
  'filters.condition': 'Condition',
  'filters.area': 'Area',
  'filters.school': 'School',
  'filters.sort': 'Sort by',
  'filters.photosOnly': 'Only books with photos',
  'filters.clear': 'Clear all',
  'filters.show': 'Show results',
  'filters.close': 'Close filters',

  'sort.newest': 'Newest first',
  'sort.oldest': 'Oldest first',
  'sort.my_area': 'My area first',
  'sort.photos': 'With photos first',

  'condition.new': 'New',
  'condition.good': 'Good',
  'condition.worn': 'Worn',

  'wanted.title': 'Wanted',
  'wanted.subtitle': 'Books families are looking for. Have one? Tap it and say so.',
  'wanted.post': 'Post a request',
  'wanted.emptyTitle': 'No requests yet',
  'wanted.emptyMsg': 'Looking for a book nobody has listed? Post a request and we will tell you when someone has it.',
  'wanted.iHaveThis': 'I have this book',
  'wanted.yourRequest': 'Your request',
  'wanted.responses': 'Replies',
  'wanted.noResponses': 'No replies yet. We will notify you the moment someone has it.',
  'wanted.markFound': 'Mark as found',
  'wanted.reopen': 'Reopen request',
  'wanted.delete': 'Delete request',
  'wanted.deleteConfirm': 'Delete this request?',
  'wanted.responded': 'Sent. The family will see your contact details.',
  'wanted.youResponded': 'You replied to this request.',
  'wanted.signInToReply': 'Sign in to reply to a request.',
  'wanted.lookingFor': 'Looking for',
  'wanted.postedBy': 'Posted by {name}',
  'wanted.fulfilled': 'Found',
  'wanted.notFound': 'This request could not be found.',

  'request.title': 'Post a request',
  'request.intro': 'Tell families what you need. Anyone who has it can reply with their contact.',
  'request.bookTitle': 'Book title',
  'request.note': 'Anything else (optional)',
  'request.notePlaceholder': 'Edition, publisher, condition you would accept...',
  'request.yourName': 'Your name (shown on the request)',
  'request.submit': 'Post request',
  'request.posted': 'Posted. We will tell you when someone has it.',
  'request.needTitle': 'Add the book title.',
  'request.needName': 'Add your name.',
  'request.signIn': 'Sign in to post a request.',

  'reply.title': 'I have this book',
  'reply.intro': 'Share how the family can reach you. Only they will see it.',
  'reply.message': 'Message (optional)',
  'reply.send': 'Send',

  'notif.title': 'Notifications',
  'notif.empty': 'Nothing yet. Set up an alert from Browse to hear about new books.',
  'notif.markAllRead': 'Mark all read',
  'notif.signIn': 'Sign in to see your notifications.',

  'alerts.title': 'Alerts',
  'alerts.subtitle': 'We will notify you when a new book matches one of these.',
  'alerts.empty': 'No alerts yet. On Browse, set your filters and tap Notify me.',
  'alerts.any': 'Any',
  'alerts.delete': 'Remove',
  'alerts.removed': 'Alert removed.',

  'profile.language': 'Language',
  'profile.restartNote': 'Restart the app to switch the layout direction.',
  'profile.alerts': 'My alerts',
  'profile.notifications': 'Notifications',
  'profile.myRequests': 'My requests',
  'profile.school': 'School (optional)',
  'profile.manageSchools': 'Manage schools',

  'create.category': 'What kind of book?',
  'create.genre': 'Genre',
  'create.ageBand': 'Age range',
  'create.school': 'School (optional)',
  'create.otherSchool': 'School name',
  'create.chooseGenre': 'Choose a genre.',
  'create.chooseAge': 'Choose an age range.',
  'create.chooseArea': 'Choose your area...',
  'create.contentTitle': 'Keep it family-safe',
  'create.contentBody': "Oman's publication rules apply. Only list reading books that are suitable for children and families: no adult or explicit content, no extremist or hateful material, and nothing that offends religion or public morals. We remove listings that break this and can suspend the account.",
  'create.contentCheck': 'This book is appropriate for all ages and follows these rules.',
  'create.contentAck': 'Please confirm the book follows the content rules.',
  'request.needArea': 'Choose your area.',

  'schools.other': 'Other / not listed',
  'schools.none': 'No school',
  'schools.choose': 'Choose a school...',

  'admin.schools': 'Schools',
  'admin.schoolsHint': 'This list powers the school dropdown and filter on the website and the app.',
  'admin.addSchool': 'Add a school',
  'admin.schoolName': 'School name',
  'admin.schoolArea': 'Area (optional)',
  'admin.add': 'Add',
  'admin.hide': 'Hide',
  'admin.show': 'Show',
  'admin.hidden': 'Hidden',
  'admin.schoolAdded': 'School added.',
  'admin.schoolExists': 'That school is already on the list.',
  'admin.areas': 'Areas',
  'admin.areasHint': 'Pickup areas offered in the area dropdowns and the filter on the website and the app.',
  'admin.addArea': 'Add an area',
  'admin.areaName': 'Area name',
  'admin.areaRegion': 'Region',
  'admin.areaAdded': 'Area added.',
  'admin.areaExists': 'That area is already on the list.',
  'admin.areasEmpty': 'No areas yet. Run the migration in Supabase, then add one above.',

  'detail.genre': 'Genre',
  'detail.ageRange': 'Age range',
  'detail.school': 'School',
  'detail.area': 'Pickup area',
  'detail.about': 'About this book',
  'detail.contact': 'Get in touch',

  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.done': 'Done',
  'common.signIn': 'Sign in',
  'common.retry': 'Retry',
  'common.all': 'All',
  'common.any': 'Any',
  'common.error': 'Something went wrong. Try again?',
  'common.loadError': 'Could not load',
} as const;

export type StringKey = keyof typeof en;

const ar: Record<StringKey, string> = {
  'tabs.browse': 'تصفح',
  'tabs.saved': 'المحفوظة',
  'tabs.list': 'أضف',
  'tabs.wanted': 'مطلوب',
  'tabs.profile': 'حسابي',

  'browse.tagline': 'كتب مدرسية مجانية تتناقلها العائلات في عُمان.',
  'browse.taglineReading': 'قصص وروايات وغيرها، تُمرَّر مجاناً.',
  'browse.search': 'ابحث بالعنوان أو المادة',
  'browse.searchReading': 'ابحث بالعنوان أو النوع',
  'browse.filters': 'تصفية',
  'browse.clearAll': 'مسح الكل',
  'browse.oneBook': 'كتاب واحد',
  'browse.nBooks': '{n} كتب',
  'browse.noMatchTitle': 'لا توجد كتب مطابقة',
  'browse.noMatchMsg': 'جرّب توسيع البحث أو التصفية، أو كن أول من يضيف هذا الكتاب.',
  'browse.clearFilters': 'مسح التصفية',
  'browse.listABook': 'أضف كتاباً',
  'browse.emptyTitle': 'لا توجد كتب بعد',
  'browse.emptyMsg': 'غرين شيلف جديد تماماً. كن أول عائلة في عُمان تمرّر كتاباً. لا يستغرق الأمر دقيقة.',
  'browse.notifyMe': 'نبّهني',
  'browse.notifyHint': 'سنخبرك عند نشر كتاب يطابق هذه التصفية.',
  'browse.alertSaved': 'تم الحفظ. سنخبرك عند نشر كتاب مطابق.',
  'browse.signInForAlerts': 'سجّل الدخول لتصلك تنبيهات الكتب الجديدة.',
  'browse.shared': 'تم تمرير {n} كتاباً حتى الآن',
  'browse.notifications': 'الإشعارات',

  'category.school': 'كتب مدرسية',
  'category.reading': 'كتب للقراءة',

  'filters.title': 'التصفية',
  'filters.grade': 'الصف',
  'filters.age': 'العمر',
  'filters.subject': 'المادة',
  'filters.genre': 'النوع',
  'filters.condition': 'الحالة',
  'filters.area': 'المنطقة',
  'filters.school': 'المدرسة',
  'filters.sort': 'الترتيب',
  'filters.photosOnly': 'الكتب ذات الصور فقط',
  'filters.clear': 'مسح الكل',
  'filters.show': 'عرض النتائج',
  'filters.close': 'إغلاق التصفية',

  'sort.newest': 'الأحدث أولاً',
  'sort.oldest': 'الأقدم أولاً',
  'sort.my_area': 'منطقتي أولاً',
  'sort.photos': 'ذات الصور أولاً',

  'condition.new': 'جديد',
  'condition.good': 'جيد',
  'condition.worn': 'مستعمل',

  'wanted.title': 'مطلوب',
  'wanted.subtitle': 'كتب تبحث عنها العائلات. لديك واحد؟ اضغط عليه وأخبرهم.',
  'wanted.post': 'أضف طلباً',
  'wanted.emptyTitle': 'لا توجد طلبات بعد',
  'wanted.emptyMsg': 'تبحث عن كتاب لم يضفه أحد؟ أضف طلباً وسنخبرك عندما يتوفر لدى أحدهم.',
  'wanted.iHaveThis': 'لديّ هذا الكتاب',
  'wanted.yourRequest': 'طلبك',
  'wanted.responses': 'الردود',
  'wanted.noResponses': 'لا توجد ردود بعد. سنخبرك فور توفره لدى أحد.',
  'wanted.markFound': 'تم العثور عليه',
  'wanted.reopen': 'إعادة فتح الطلب',
  'wanted.delete': 'حذف الطلب',
  'wanted.deleteConfirm': 'حذف هذا الطلب؟',
  'wanted.responded': 'تم الإرسال. ستظهر بيانات تواصلك للعائلة.',
  'wanted.youResponded': 'لقد رددت على هذا الطلب.',
  'wanted.signInToReply': 'سجّل الدخول للرد على الطلب.',
  'wanted.lookingFor': 'يبحث عن',
  'wanted.postedBy': 'نشره {name}',
  'wanted.fulfilled': 'تم العثور عليه',
  'wanted.notFound': 'تعذّر العثور على هذا الطلب.',

  'request.title': 'أضف طلباً',
  'request.intro': 'أخبر العائلات بما تحتاجه. من لديه الكتاب يمكنه الرد ببيانات تواصله.',
  'request.bookTitle': 'عنوان الكتاب',
  'request.note': 'تفاصيل إضافية (اختياري)',
  'request.notePlaceholder': 'الطبعة، الناشر، الحالة المقبولة...',
  'request.yourName': 'اسمك (يظهر على الطلب)',
  'request.submit': 'نشر الطلب',
  'request.posted': 'تم النشر. سنخبرك عندما يتوفر لدى أحد.',
  'request.needTitle': 'أضف عنوان الكتاب.',
  'request.needName': 'أضف اسمك.',
  'request.signIn': 'سجّل الدخول لنشر طلب.',

  'reply.title': 'لديّ هذا الكتاب',
  'reply.intro': 'شارك طريقة التواصل معك. لن تراها إلا هذه العائلة.',
  'reply.message': 'رسالة (اختياري)',
  'reply.send': 'إرسال',

  'notif.title': 'الإشعارات',
  'notif.empty': 'لا شيء بعد. فعّل تنبيهاً من صفحة التصفح لتصلك الكتب الجديدة.',
  'notif.markAllRead': 'تعليم الكل كمقروء',
  'notif.signIn': 'سجّل الدخول لعرض إشعاراتك.',

  'alerts.title': 'التنبيهات',
  'alerts.subtitle': 'سنخبرك عند نشر كتاب يطابق أحد هذه التنبيهات.',
  'alerts.empty': 'لا توجد تنبيهات بعد. في صفحة التصفح، اختر التصفية ثم اضغط نبّهني.',
  'alerts.any': 'أي',
  'alerts.delete': 'إزالة',
  'alerts.removed': 'تمت إزالة التنبيه.',

  'profile.language': 'اللغة',
  'profile.restartNote': 'أعد تشغيل التطبيق لتبديل اتجاه الواجهة.',
  'profile.alerts': 'تنبيهاتي',
  'profile.notifications': 'الإشعارات',
  'profile.myRequests': 'طلباتي',
  'profile.school': 'المدرسة (اختياري)',
  'profile.manageSchools': 'إدارة المدارس',

  'create.category': 'ما نوع الكتاب؟',
  'create.genre': 'النوع',
  'create.ageBand': 'الفئة العمرية',
  'create.school': 'المدرسة (اختياري)',
  'create.otherSchool': 'اسم المدرسة',
  'create.chooseGenre': 'اختر النوع.',
  'create.chooseAge': 'اختر الفئة العمرية.',
  'create.chooseArea': 'اختر منطقتك...',
  'create.contentTitle': 'حافظ على محتوى مناسب للعائلة',
  'create.contentBody': 'تنطبق أنظمة المطبوعات في سلطنة عُمان. أدرج فقط كتب القراءة المناسبة للأطفال والعائلات: لا محتوى للبالغين أو صريحاً، ولا مواد متطرفة أو تحض على الكراهية، ولا ما يسيء إلى الدين أو الآداب العامة. نحذف الإعلانات المخالفة وقد نعلّق الحساب.',
  'create.contentCheck': 'هذا الكتاب مناسب لجميع الأعمار ويلتزم بهذه القواعد.',
  'create.contentAck': 'يرجى تأكيد التزام الكتاب بقواعد المحتوى.',
  'request.needArea': 'اختر منطقتك.',

  'schools.other': 'أخرى / غير مدرجة',
  'schools.none': 'بدون مدرسة',
  'schools.choose': 'اختر مدرسة...',

  'admin.schools': 'المدارس',
  'admin.schoolsHint': 'تغذّي هذه القائمة قائمة المدارس والتصفية في الموقع والتطبيق.',
  'admin.addSchool': 'إضافة مدرسة',
  'admin.schoolName': 'اسم المدرسة',
  'admin.schoolArea': 'المنطقة (اختياري)',
  'admin.add': 'إضافة',
  'admin.hide': 'إخفاء',
  'admin.show': 'إظهار',
  'admin.hidden': 'مخفية',
  'admin.schoolAdded': 'تمت إضافة المدرسة.',
  'admin.schoolExists': 'هذه المدرسة موجودة في القائمة.',
  'admin.areas': 'المناطق',
  'admin.areasHint': 'مناطق الاستلام المعروضة في قوائم المناطق والتصفية في الموقع والتطبيق.',
  'admin.addArea': 'إضافة منطقة',
  'admin.areaName': 'اسم المنطقة',
  'admin.areaRegion': 'داخل مسقط أم خارجها',
  'admin.areaAdded': 'تمت إضافة المنطقة.',
  'admin.areaExists': 'هذه المنطقة موجودة في القائمة.',
  'admin.areasEmpty': 'لا توجد مناطق بعد. شغّل الترحيل في Supabase ثم أضف واحدة أعلاه.',

  'detail.genre': 'النوع',
  'detail.ageRange': 'الفئة العمرية',
  'detail.school': 'المدرسة',
  'detail.area': 'منطقة الاستلام',
  'detail.about': 'عن هذا الكتاب',
  'detail.contact': 'تواصل',

  'common.cancel': 'إلغاء',
  'common.save': 'حفظ',
  'common.delete': 'حذف',
  'common.done': 'تم',
  'common.signIn': 'تسجيل الدخول',
  'common.retry': 'إعادة المحاولة',
  'common.all': 'الكل',
  'common.any': 'أي',
  'common.error': 'حدث خطأ ما. حاول مرة أخرى؟',
  'common.loadError': 'تعذّر التحميل',
};

const STRINGS: Record<Lang, Record<StringKey, string>> = { en, ar };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  isRTL: boolean;        // what the current layout actually is
  needsRestart: boolean; // chosen language direction differs from the live layout
}

const Ctx = createContext<I18nCtx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'en' || v === 'ar') setLangState(v);
    });
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(STORAGE_KEY, l).catch(() => {});
    // Direction is native: this is remembered by the OS-level bridge and
    // applied on the next cold start. Text swaps immediately.
    try {
      I18nManager.allowRTL(l === 'ar');
      I18nManager.forceRTL(l === 'ar');
    } catch {
      /* not supported on this platform */
    }
  };

  const value = useMemo<I18nCtx>(() => {
    const table = STRINGS[lang];
    const t = (key: StringKey, vars?: Record<string, string | number>) => {
      let s: string = table[key] ?? en[key] ?? key;
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
      return s;
    };
    const wantRTL = lang === 'ar';
    return { lang, setLang, t, isRTL: I18nManager.isRTL, needsRestart: wantRTL !== I18nManager.isRTL };
  }, [lang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider');
  return ctx;
}
