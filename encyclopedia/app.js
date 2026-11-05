/* Trilingual Financial Encyclopedia — entekhab.net
   Data: index.json (light, loaded first) + terms.json (full, lazy) + meta.json
   No build step, no framework, no tracking. */
'use strict';

/* ---------------- i18n ---------------- */
const T = {
  fa:{dir:'rtl',name:'فارسی',
    brand:'دانشنامهٔ بازارهای مالی',
    nav:{home:'خانه',dict:'واژه‌نامه',cats:'دسته‌ها',academy:'آکادمی',calc:'ماشین‌حساب‌ها',map:'نقشهٔ مفاهیم',editorial:'کنترل کیفیت',about:'دربارهٔ دانشنامه'},
    search:'جستجو در سه زبان، مخفف‌ها و غلط‌های تایپی…',
    heroEyebrow:'دانشنامهٔ سه‌زبانهٔ بازارهای مالی',
    heroTitle:'زبان بازارهای مالی، به سه زبان و با منبع',
    heroLede:'هر مدخل در انگلیسی، فارسی و کوردی سۆرانی نوشته شده — نه ترجمهٔ ماشینی — همراه با تعریف ساده، حرفه‌ای، فنی و دانشگاهی، مکانیزم، مثال عددی، فرمول و منبع تأییدشده. وضعیت بازبینی هر مدخل صریح اعلام می‌شود.',
    stTerms:'مدخل',stCats:'دسته',stMath:'فرمول',stSrc:'منبع تأییدشده',stLang:'زبان برابر',
    browseCats:'مرور دسته‌ها',startLearn:'شروع یادگیری',
    simple:'ساده',pro:'حرفه‌ای',technical:'فنی',academic:'دانشگاهی',
    mechanism:'مکانیزم',practice:'کاربرد عملی',examples:'مثال‌ها',math:'مبنای ریاضی',
    relations:'اصطلاحات مرتبط',sources:'منابع و اعتبارسنجی',editorialPanel:'وضعیت ویرایشی',
    who:'چه کسانی به‌کار می‌برند',why:'چرا مهم است',limits:'محدودیت‌ها',mistakes:'خطاهای رایج',
    vars:'متغیرها',procedure:'روش محاسبه',worked:'مثال حل‌شده',interp:'تفسیر نتیجه',
    assumptions:'فرض‌ها',mlimits:'محدودیت‌های فرمول',
    given:'داده‌ها',steps:'مراحل',result:'نتیجه',
    synonyms:'مترادف',antonyms:'متضاد',related:'مرتبط',confused:'اغلب اشتباه گرفته می‌شود با',
    parent:'مفهوم والد',children:'مفاهیم فرزند',
    level:'سطح',lvl1:'مبانی',lvl2:'حرفه‌ای',lvl3:'تخصصی',
    cat:'دسته',sub:'زیردسته',pron:'تلفظ',abbr:'مخفف',aka:'نام‌های دیگر',
    verified:'نشانی تأییدشده',unverified:'منبع چاپی — بدون نشانی',
    noResults:'نتیجه‌ای یافت نشد. املای دیگری، مخفف، یا واژهٔ فارسی/کوردی را امتحان کنید.',
    results:'نتیجه',searchTitle:'جستجوی پیشرفته',
    fCat:'دسته',fLevel:'سطح',fStatus:'وضعیت ویرایشی',fMath:'فرمول',fLang:'زبان معادل',
    any:'همه',hasMath:'دارای فرمول',noMath:'بدون فرمول',
    recent:'جستجوهای اخیر',clear:'پاک کردن',
    dictTitle:'واژه‌نامهٔ کامل',dictLede:'همهٔ مدخل‌ها به ترتیب الفبا. ستون هر زبان را می‌توانید جداگانه ببینید.',
    sortBy:'ترتیب',byEn:'انگلیسی',byFa:'فارسی',byCkb:'کوردی',byCat:'دسته',
    catsTitle:'نظام ردهٔ دانش',catsLede:'هجده دستهٔ اصلی، هر یک با زیردسته‌ها و ارجاع‌های متقابل.',
    academyTitle:'آکادمی',academyLede:'سه سطح یادگیری، فلش‌کارت و آزمون. پیشرفت شما فقط در همین مرورگر ذخیره می‌شود.',
    paths:'مسیرهای یادگیری',flashcards:'فلش‌کارت',quiz:'آزمون',progress:'پیشرفت',
    startPath:'شروع',cardsDone:'کارت مرور شده',flip:'برای دیدن پاسخ کلیک کنید',
    next:'بعدی',prev:'قبلی',know:'می‌دانستم',dontKnow:'نمی‌دانستم',
    quizQ:'کدام تعریف به این اصطلاح تعلق دارد؟',score:'امتیاز',newQuiz:'آزمون تازه',
    calcTitle:'ماشین‌حساب‌های مالی',calcLede:'هر ماشین‌حساب فرمول، فرض‌ها و محدودیت‌های خود را نشان می‌دهد. محاسبه‌ها در مرورگر شما انجام می‌شود.',
    inputs:'ورودی‌ها',output:'نتیجه',
    mapTitle:'نقشهٔ مفاهیم',mapLede:'ارجاع‌های متقابل میان مدخل‌ها. برای دیدن همسایگی یک مدخل روی آن کلیک کنید.',
    mapAll:'همهٔ دسته‌ها',neighbourhood:'همسایگی',
    edTitle:'کنترل کیفیت اصطلاح‌شناسی',
    edLede:'این دانشنامه وضعیت واقعی بازبینی هر مدخل را پنهان نمی‌کند. هیچ مدخلی «منتشرشده» علامت نخورده، چون هنوز هیچ متخصص انسانی چهار مرحلهٔ بازبینی را امضا نکرده است.',
    byState:'بر اساس وضعیت',byClaim:'نوع ادعا',byCkb:'وضعیت معادل کوردی',
    gates:'مراحل بازبینی',gLang:'زبانی',gFin:'مالی',gCross:'بین‌زبانی',gSrc:'منابع',
    registry:'فهرست منابع',submitTitle:'پیشنهاد اصطلاح یا اصلاح',
    submitLede:'این سایت ایستا است و سروری ندارد؛ فرم زیر یک متن آمادهٔ ارسال می‌سازد که می‌توانید آن را کپی کنید یا مستقیم به‌عنوان issue در گیت‌هاب باز کنید.',
    fTerm:'اصطلاح انگلیسی',fFa:'معادل فارسی',fCkb:'معادل کوردی',fNote:'توضیح، منبع یا اصلاح',
    makeIssue:'ساختن issue در گیت‌هاب',copyText:'کپی متن',copied:'کپی شد',
    aboutTitle:'دربارهٔ این دانشنامه',
    disclaimer:'این دانشنامه آموزشی است و توصیهٔ مالی یا سرمایه‌گذاری نیست. هیچ محتوایی در آن پیشنهاد خرید، فروش یا نگهداری دارایی نیست. مقررات بر پایهٔ حوزهٔ قضایی متفاوت است و تغییر می‌کند.',
    footTitle:'دانشنامهٔ سه‌زبانهٔ بازارهای مالی',
    footBody:'ساختهٔ entekhab.net و کانال Coin_Kurd. دادهٔ مدخل‌ها به‌صورت باز در terms.json و meta.json در دسترس است.',
    updated:'آخرین به‌روزرسانی',
    enTerm:'اصطلاح انگلیسی',faTerm:'معادل فارسی',ckbTerm:'معادل کوردی سۆرانی',
    loading:'در حال بارگذاری متن کامل مدخل…',
    back:'بازگشت',notFound:'این مدخل یافت نشد.',
    terms:'مدخل'},
  ckb:{dir:'rtl',name:'کوردی',
    brand:'ئەنسایکلۆپیدیای بازاڕەکانی دارایی',
    nav:{home:'سەرەتا',dict:'وشەنامە',cats:'بەشەکان',academy:'ئەکادیمیا',calc:'ژمێرەرەکان',map:'نەخشەی چەمکەکان',editorial:'کۆنترۆڵی کوالیتی',about:'دەربارە'},
    search:'بگەڕێ بە سێ زمان، کورتکراوە و نووسینی هەڵە…',
    heroEyebrow:'ئەنسایکلۆپیدیای سێ‌زمانی بازاڕەکانی دارایی',
    heroTitle:'زمانی بازاڕەکانی دارایی، بە سێ زمان و بە سەرچاوە',
    heroLede:'هەر مدخلێک بە ئینگلیزی، فارسی و کوردی سۆرانی نووسراوە — نەک وەرگێرانی ئامێری — لەگەڵ پێناسەی ساکار، پیشەیی، تەکنیکی و ئەکادیمی، میکانیزم، نموونەی ژمارەیی، فۆرموڵ و سەرچاوەی پشتڕاستکراو. دۆخی پێداچوونەوەی هەر مدخلێک بە ئاشکرا ڕاگەیەنراوە.',
    stTerms:'مدخل',stCats:'بەش',stMath:'فۆرموڵ',stSrc:'سەرچاوەی پشتڕاستکراو',stLang:'زمانی یەکسان',
    browseCats:'گەڕان بە بەشەکان',startLearn:'دەستپێکردنی فێربوون',
    simple:'ساکار',pro:'پیشەیی',technical:'تەکنیکی',academic:'ئەکادیمی',
    mechanism:'میکانیزم',practice:'بەکارهێنانی پراکتیکی',examples:'نموونەکان',math:'بنەمای ماتماتیکی',
    relations:'زاراوەی پەیوەندیدار',sources:'سەرچاوە و پشتڕاستکردنەوە',editorialPanel:'دۆخی ویراستاری',
    who:'کێ بەکاری دەهێنێت',why:'بۆچی گرنگە',limits:'سنوورەکان',mistakes:'هەڵەکانی باو',
    vars:'گۆڕاوەکان',procedure:'ڕێبازی ژمێریاری',worked:'نموونەی کرابوو',interp:'لێکدانەوەی ئەنجام',
    assumptions:'گریمانەکان',mlimits:'سنووری فۆرموڵ',
    given:'داتاکان',steps:'هەنگاوەکان',result:'ئەنجام',
    synonyms:'هاومانا',antonyms:'پێچەوانە',related:'پەیوەندیدار',confused:'زۆر جار تێکەڵ دەکرێت لەگەڵ',
    parent:'چەمکی باوان',children:'چەمکی لاوەکی',
    level:'ئاست',lvl1:'بناغە',lvl2:'پیشەیی',lvl3:'تایبەتمەند',
    cat:'بەش',sub:'ژێربەش',pron:'دەربڕین',abbr:'کورتکراوە',aka:'ناوەکانی تر',
    verified:'ناونیشانی پشتڕاستکراو',unverified:'سەرچاوەی چاپکراو — بێ ناونیشان',
    noResults:'هیچ ئەنجامێک نەدۆزرایەوە. نووسینێکی تر، کورتکراوە، یان وشەی فارسی/کوردی تاقی بکە.',
    results:'ئەنجام',searchTitle:'گەڕانی پێشکەوتوو',
    fCat:'بەش',fLevel:'ئاست',fStatus:'دۆخی ویراستاری',fMath:'فۆرموڵ',fLang:'زمانی هاوتا',
    any:'هەموو',hasMath:'فۆرموڵی هەیە',noMath:'بێ فۆرموڵ',
    recent:'گەڕانەکانی ئەم دواییە',clear:'سڕینەوە',
    dictTitle:'وشەنامەی تەواو',dictLede:'هەموو مدخلەکان بە ڕیزبەندی ئەلفوبێ. دەتوانی ستوونی هەر زمانێک بە جیا ببینیت.',
    sortBy:'ڕیزبەندی',byEn:'ئینگلیزی',byFa:'فارسی',byCkb:'کوردی',byCat:'بەش',
    catsTitle:'سیستەمی پۆلێنی زانست',catsLede:'هەژدە بەشی سەرەکی، هەر یەکێک بە ژێربەش و ئاماژەی بەرامبەر.',
    academyTitle:'ئەکادیمیا',academyLede:'سێ ئاستی فێربوون، فلاشکارت و تاقیکردنەوە. بەرەوپێشچوونت تەنها لەم وێبگەڕەدا پاشەکەوت دەبێت.',
    paths:'ڕێڕەوەکانی فێربوون',flashcards:'فلاشکارت',quiz:'تاقیکردنەوە',progress:'بەرەوپێشچوون',
    startPath:'دەستپێکردن',cardsDone:'کارتی پێداچووەوە',flip:'بۆ بینینی وەڵام کلیک بکە',
    next:'دواتر',prev:'پێشتر',know:'دەمزانی',dontKnow:'نەمزانی',
    quizQ:'کام پێناسە بۆ ئەم زاراوەیەیە؟',score:'خاڵ',newQuiz:'تاقیکردنەوەی نوێ',
    calcTitle:'ژمێرەرەکانی دارایی',calcLede:'هەر ژمێرەرێک فۆرموڵ، گریمانە و سنوورەکانی خۆی نیشان دەدات. ژمێریاری لە وێبگەڕی تۆدا ئەنجام دەدرێت.',
    inputs:'داخڵکردنەکان',output:'ئەنجام',
    mapTitle:'نەخشەی چەمکەکان',mapLede:'ئاماژەی بەرامبەر لە نێوان مدخلەکان. بۆ بینینی دراوسێیەتی مدخلێک کلیکی لێ بکە.',
    mapAll:'هەموو بەشەکان',neighbourhood:'دراوسێیەتی',
    edTitle:'کۆنترۆڵی کوالیتی زاراوەسازی',
    edLede:'ئەم ئەنسایکلۆپیدیا دۆخی ڕاستەقینەی پێداچوونەوەی هەر مدخلێک ناشارێتەوە. هیچ مدخلێک وەک «بڵاوکراوە» نیشانە نەکراوە، چونکە هێشتا هیچ شارەزایەکی مرۆیی چوار قۆناغی پێداچوونەوە واژۆ نەکردووە.',
    byState:'بەپێی دۆخ',byClaim:'جۆری بانگەشە',byCkb:'دۆخی هاوتای کوردی',
    gates:'قۆناغەکانی پێداچوونەوە',gLang:'زمانی',gFin:'دارایی',gCross:'نێوان‌زمانی',gSrc:'سەرچاوەکان',
    registry:'لیستی سەرچاوەکان',submitTitle:'پێشنیاری زاراوە یان چاککردنەوە',
    submitLede:'ئەم سایتە جێگیرە و سێرڤەری نییە؛ فۆرمی خوارەوە دەقێکی ئامادە دروست دەکات کە دەتوانی کۆپی بکەیت یان ڕاستەوخۆ وەک issue لە گیتهابدا بکەیتەوە.',
    fTerm:'زاراوەی ئینگلیزی',fFa:'هاوتای فارسی',fCkb:'هاوتای کوردی',fNote:'ڕوونکردنەوە، سەرچاوە یان چاککردنەوە',
    makeIssue:'دروستکردنی issue لە گیتهاب',copyText:'کۆپی دەق',copied:'کۆپی کرا',
    aboutTitle:'دەربارەی ئەم ئەنسایکلۆپیدیا',
    disclaimer:'ئەم ئەنسایکلۆپیدیا فێرکارییە و ئامۆژگاری دارایی یان وەبەرهێنان نییە. هیچ ناوەڕۆکێکی تێدا پێشنیاری کڕین، فرۆشتن یان هەڵگرتنی سامان ناکات. ڕێساکان بەپێی ناوچەی یاسایی جیاوازن و دەگۆڕێن.',
    footTitle:'ئەنسایکلۆپیدیای سێ‌زمانی بازاڕەکانی دارایی',
    footBody:'دروستکراوی entekhab.net و کەناڵی Coin_Kurd. داتای مدخلەکان بە شێوەی کراوە لە terms.json و meta.json بەردەستە.',
    updated:'دوا نوێکردنەوە',
    enTerm:'زاراوەی ئینگلیزی',faTerm:'هاوتای فارسی',ckbTerm:'هاوتای کوردی سۆرانی',
    loading:'دەقی تەواوی مدخل بار دەکرێت…',
    back:'گەڕانەوە',notFound:'ئەم مدخلە نەدۆزرایەوە.',
    terms:'مدخل'},
  en:{dir:'ltr',name:'English',
    brand:'Financial Markets Encyclopedia',
    nav:{home:'Home',dict:'Dictionary',cats:'Categories',academy:'Academy',calc:'Calculators',map:'Concept map',editorial:'Quality control',about:'About'},
    search:'Search across three languages, acronyms and misspellings…',
    heroEyebrow:'Trilingual encyclopedia of financial markets',
    heroTitle:'The language of financial markets, in three languages, with sources',
    heroLede:'Every entry is written in English, Persian and Kurdish Sorani — not machine-translated — with simple, professional, technical and academic definitions, the underlying mechanism, a worked numeric example, the formula where one exists, and cited sources. Each entry states its real review status.',
    stTerms:'entries',stCats:'categories',stMath:'formulas',stSrc:'verified sources',stLang:'equal languages',
    browseCats:'Browse categories',startLearn:'Start learning',
    simple:'Simple',pro:'Professional',technical:'Technical',academic:'Academic',
    mechanism:'Mechanism',practice:'In practice',examples:'Examples',math:'Mathematical foundation',
    relations:'Related terminology',sources:'Sources and verification',editorialPanel:'Editorial status',
    who:'Who uses it',why:'Why it matters',limits:'Limitations',mistakes:'Common mistakes',
    vars:'Variables',procedure:'Calculation procedure',worked:'Worked example',interp:'Interpreting the result',
    assumptions:'Assumptions',mlimits:'Limits of the formula',
    given:'Given',steps:'Steps',result:'Result',
    synonyms:'Synonyms',antonyms:'Antonyms',related:'Related',confused:'Commonly confused with',
    parent:'Parent concept',children:'Child concepts',
    level:'Level',lvl1:'Foundation',lvl2:'Professional',lvl3:'Expert',
    cat:'Category',sub:'Subcategory',pron:'Pronunciation',abbr:'Abbreviation',aka:'Also known as',
    verified:'URL verified',unverified:'Print source — no URL',
    noResults:'Nothing found. Try another spelling, an acronym, or the Persian or Kurdish word.',
    results:'results',searchTitle:'Advanced search',
    fCat:'Category',fLevel:'Level',fStatus:'Editorial state',fMath:'Formula',fLang:'Equivalent status',
    any:'Any',hasMath:'Has a formula',noMath:'No formula',
    recent:'Recent searches',clear:'Clear',
    dictTitle:'Complete dictionary',dictLede:'Every entry in alphabetical order. Each language can be read as its own column.',
    sortBy:'Sort by',byEn:'English',byFa:'Persian',byCkb:'Kurdish',byCat:'Category',
    catsTitle:'Knowledge classification',catsLede:'Eighteen top-level categories, each with subcategories and cross-references.',
    academyTitle:'Academy',academyLede:'Three learning levels, flashcards and quizzes. Your progress is stored in this browser only.',
    paths:'Learning paths',flashcards:'Flashcards',quiz:'Quiz',progress:'Progress',
    startPath:'Start',cardsDone:'cards reviewed',flip:'Click to reveal the answer',
    next:'Next',prev:'Previous',know:'I knew it',dontKnow:'I did not',
    quizQ:'Which definition belongs to this term?',score:'Score',newQuiz:'New quiz',
    calcTitle:'Financial calculators',calcLede:'Each calculator shows its formula, its assumptions and its limits. Everything is computed in your browser.',
    inputs:'Inputs',output:'Result',
    mapTitle:'Concept map',mapLede:'Cross-references between entries. Click an entry to see its neighbourhood.',
    mapAll:'All categories',neighbourhood:'Neighbourhood',
    edTitle:'Terminology quality control',
    edLede:'This encyclopedia does not hide the real review status of its entries. Nothing is marked published, because no human expert has yet signed the four review gates.',
    byState:'By state',byClaim:'Claim type',byCkb:'Kurdish equivalent status',
    gates:'Review gates',gLang:'Language',gFin:'Finance',gCross:'Cross-language',gSrc:'Sources',
    registry:'Source registry',submitTitle:'Propose a term or a correction',
    submitLede:'This is a static site with no server. The form below composes a ready-to-send text you can copy, or open directly as a GitHub issue.',
    fTerm:'English term',fFa:'Persian equivalent',fCkb:'Kurdish equivalent',fNote:'Explanation, source or correction',
    makeIssue:'Open a GitHub issue',copyText:'Copy text',copied:'Copied',
    aboutTitle:'About this encyclopedia',
    disclaimer:'This encyclopedia is educational and is not financial or investment advice. Nothing in it recommends buying, selling or holding any asset. Regulation differs by jurisdiction and changes over time.',
    footTitle:'Trilingual Financial Markets Encyclopedia',
    footBody:'Built for entekhab.net and the Coin_Kurd channel. Entry data is openly available in terms.json and meta.json.',
    updated:'Last updated',
    enTerm:'English term',faTerm:'Persian equivalent',ckbTerm:'Kurdish Sorani equivalent',
    loading:'Loading the full entry text…',
    back:'Back',notFound:'That entry was not found.',
    terms:'entries'}
};
const LANGS=['fa','ckb','en'];

/* ---------------- state ---------------- */
const S={lang:'fa',idx:[],meta:null,shards:new Map(),route:{page:'home'},depth:'simple'};
const REPO='https://github.com/omidmokri/coinkurd';

/* ---------------- utils ---------------- */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=()=>T[S.lang];
function lsGet(k,d){try{const v=localStorage.getItem('enc:'+k);return v?JSON.parse(v):d}catch(e){return d}}
function lsSet(k,v){try{localStorage.setItem('enc:'+k,JSON.stringify(v))}catch(e){}}
function norm(s){
  return String(s||'').toLowerCase()
    .replace(/[ً-ْٰـ]/g,'')      // Arabic diacritics + tatweel
    .replace(/[يیۍ]/g,'ی').replace(/[كک]/g,'ک')
    .replace(/[ۆو]/g,'و').replace(/[أإآا]/g,'ا').replace(/[ةه]/g,'ه')
    .replace(/[ڕر]/g,'ر').replace(/[ێێ]/g,'ێ')
    .replace(/[‌‏‎]/g,'')
    .replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
function bigrams(s){const a=[];const x=' '+s+' ';for(let i=0;i<x.length-1;i++)a.push(x.slice(i,i+2));return a}
function dice(a,b){
  if(!a||!b)return 0; if(a===b)return 1;
  const A=bigrams(a),B=new Map();
  for(const g of bigrams(b))B.set(g,(B.get(g)||0)+1);
  let hit=0; for(const g of A){const c=B.get(g); if(c){hit++;B.set(g,c-1)}}
  return 2*hit/(A.length+bigrams(b).length);
}
function katex(el,tex,display){
  if(!window.katex)  {el.textContent=tex;return}
  try{window.katex.render(tex,el,{displayMode:!!display,throwOnError:false,strict:false})}
  catch(e){el.textContent=tex}
}
function renderMathIn(root){
  root.querySelectorAll('[data-tex]').forEach(el=>katex(el,el.getAttribute('data-tex'),el.hasAttribute('data-display')));
}
const CATC={};for(const k of ['slate','amber','teal','violet','blue','green','lime','orange','cyan',
  'indigo','red','brown','purple','pink','zinc','stone','emerald','rose'])CATC[k]='var(--c-'+k+')';
const catById=id=>(S.meta?S.meta.categories.find(c=>c.id===id):null);
const catColor=id=>{const c=catById(id);return c?(CATC[c.accent]||'var(--c-slate)'):'var(--c-slate)'};
const statusTone=sid=>{const s=S.meta&&S.meta.term_status.find(x=>x.id===sid);return s?s.tone:'neutral'};
const toneCls=tn=>tn==='good'?'good':tn==='warn'?'warn':tn==='bad'?'bad':'';
function statusLabel(sid){const s=S.meta&&S.meta.term_status.find(x=>x.id===sid);return s?s.label[S.lang]:sid}
function stateLabel(sid){const s=S.meta&&S.meta.editorial_states.find(x=>x.id===sid);return s?s.label[S.lang]:sid}
function lvlLabel(n){return t()['lvl'+n]||n}
const href=(page,arg)=>'#/'+S.lang+'/'+page+(arg?'/'+encodeURIComponent(arg):'');

/* ---------------- data ---------------- */
async function boot(){
  try{
    const [idx,meta]=await Promise.all([
      fetch('index.json').then(r=>r.json()),
      fetch('meta.json').then(r=>r.json())
    ]);
    S.idx=idx;S.meta=meta;
  }catch(e){
    $('#view').innerHTML='<div class="notice">Data files could not be loaded. index.json and meta.json must sit next to index.html.</div>';
    return;
  }
  const savedLang=lsGet('lang',null);
  const h=location.hash.match(/^#\/(fa|ckb|en)\//);
  S.lang=h?h[1]:(savedLang&&LANGS.includes(savedLang)?savedLang:'fa');
  const th=lsGet('theme',null); if(th)document.documentElement.setAttribute('data-theme',th);
  applyLang();
  window.addEventListener('hashchange',route);
  route();
  wireChrome();
}
/* Full entry text is sharded by category: terms/<cat>.json is fetched on demand and cached,
   so opening one term downloads ~0.5MB instead of the whole 8MB corpus. */
const getFull=id=>{
  const l=S.idx.find(x=>x.i===id); if(!l)return null;
  const sh=S.shards.get(l.c); return sh?sh[id]:null;
};
const shardPending=new Map();
function loadShard(cat){
  if(S.shards.has(cat))return Promise.resolve(S.shards.get(cat));
  if(shardPending.has(cat))return shardPending.get(cat);
  const p=fetch('terms/'+cat+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()})
    .then(d=>{S.shards.set(cat,d);shardPending.delete(cat);return d})
    .catch(e=>{shardPending.delete(cat);throw e});
  shardPending.set(cat,p); return p;
}

/* ---------------- chrome ---------------- */
function applyLang(){
  const L=t();
  document.documentElement.lang=S.lang==='ckb'?'ckb':S.lang;
  document.documentElement.dir=L.dir;
  document.body.setAttribute('data-lang',S.lang);
  document.body.dir=L.dir;
  $('#brandName').textContent=L.brand;
  $('#q').placeholder=L.search;
  $('#q').setAttribute('aria-label',L.nav.dict);
  $('#disclaimer').textContent=L.disclaimer;
  $('#footTitle').textContent=L.footTitle;
  $('#footBody').textContent=L.footBody;
  $('#footMeta').innerHTML='<span class="mono xs">'+esc(L.updated)+': '+esc(S.meta?S.meta.built:'')+'</span><br><a class="xs" href="'+REPO+'">'+esc(REPO.replace('https://',''))+'</a>';
  document.querySelectorAll('.langs button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===S.lang)));
  const pages=['home','dict','cats','academy','calc','map','editorial','about'];
  $('#nav').innerHTML=pages.map(p=>'<a href="'+href(p)+'" data-page="'+p+'">'+esc(L.nav[p])+'</a>').join('');
  markNav();
  lsSet('lang',S.lang);
}
function markNav(){
  document.querySelectorAll('#nav a').forEach(a=>{
    if(a.dataset.page===S.route.page)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
  });
}
function wireChrome(){
  document.querySelectorAll('.langs button').forEach(b=>b.addEventListener('click',()=>{
    const parts=(location.hash||'').replace(/^#\//,'').split('/');
    S.lang=b.dataset.lang;
    if(parts.length>=2){parts[0]=S.lang;location.hash='#/'+parts.join('/')}
    else location.hash=href('home');
    applyLang();route();
  }));
  $('#theme').addEventListener('click',()=>{
    // the site itself is dark-only; dark is the default here and light is opt-in
    const next=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';
    document.documentElement.setAttribute('data-theme',next);lsSet('theme',next);
  });
  const q=$('#q');
  q.addEventListener('input',()=>ac(q.value));
  q.addEventListener('keydown',e=>{
    const box=$('#ac');
    if(e.key==='Escape'){box.hidden=true;q.setAttribute('aria-expanded','false');return}
    if(e.key==='Enter'){
      const on=box.querySelector('a.on');
      if(on&&!box.hidden){location.hash=on.getAttribute('href')}
      else if(q.value.trim())location.hash=href('search',q.value.trim());
      box.hidden=true;q.setAttribute('aria-expanded','false');q.blur();return;
    }
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();
      const items=[...box.querySelectorAll('a')];if(!items.length)return;
      let i=items.findIndex(x=>x.classList.contains('on'));
      items.forEach(x=>x.classList.remove('on'));
      i=e.key==='ArrowDown'?(i+1)%items.length:(i<=0?items.length-1:i-1);
      items[i].classList.add('on');items[i].scrollIntoView({block:'nearest'});
    }
  });
  document.addEventListener('click',e=>{if(!e.target.closest('.sbox'))$('#ac').hidden=true});
  // warm the shard before the click lands
  const warm=ev=>{const a=ev.target.closest&&ev.target.closest('a[href*="/term/"]');if(!a)return;
    const m=a.getAttribute('href').match(/\/term\/([^/?#]+)/); if(!m)return;
    const l=S.idx.find(x=>x.i===decodeURIComponent(m[1])); if(l&&!S.shards.has(l.c))loadShard(l.c).catch(()=>{});};
  document.addEventListener('mouseover',warm,{passive:true});
  document.addEventListener('focusin',warm,{passive:true});
  document.addEventListener('keydown',e=>{
    if(e.key==='/'&&!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){e.preventDefault();$('#q').focus()}
  });
}

/* ---------------- search engine ---------------- */
let SI=null;
function searchIndex(){
  if(SI)return SI;
  SI=S.idx.map(e=>({
    e,
    heads:{en:norm(e.t.en),fa:norm(e.t.fa),ckb:norm(e.t.ckb)},
    abbr:(e.a||[]).map(norm),
    kw:(e.k||[]).map(norm),
    defs:{en:norm(e.d.en),fa:norm(e.d.fa),ckb:norm(e.d.ckb)},
    id:norm(e.i.replace(/-/g,' '))
  }));
  return SI;
}
function search(raw,filters){
  const q=norm(raw);
  const out=[];
  const F=filters||{};
  for(const r of searchIndex()){
    const e=r.e;
    if(F.cat&&e.c!==F.cat)continue;
    if(F.level&&String(e.l)!==String(F.level))continue;
    if(F.state&&e.e!==F.state)continue;
    if(F.math==='1'&&!e.m)continue;
    if(F.math==='0'&&e.m)continue;
    if(F.ckb&&e.s.ckb!==F.ckb)continue;
    if(!q){out.push({e,sc:1,why:''});continue}
    let sc=0,why='';
    for(const L of LANGS){
      const h=r.heads[L];
      if(h===q){sc=Math.max(sc,100);why=why||'head'}
      else if(h.startsWith(q)){sc=Math.max(sc,82);why=why||'head'}
      else if(q.length>2&&h.includes(q)){sc=Math.max(sc,64);why=why||'head'}
    }
    for(const a of r.abbr){
      if(a===q)sc=Math.max(sc,96);
      else if(q.length>1&&a.startsWith(q))sc=Math.max(sc,74);
    }
    if(r.id===q)sc=Math.max(sc,92);
    else if(q.length>2&&r.id.includes(q))sc=Math.max(sc,58);
    for(const k of r.kw){
      if(k===q){sc=Math.max(sc,72);why=why||'kw'}
      else if(q.length>2&&k.includes(q)){sc=Math.max(sc,46);why=why||'kw'}
    }
    if(sc<60&&q.length>3){
      let best=0;
      for(const L of LANGS)best=Math.max(best,dice(r.heads[L],q));
      for(const k of r.kw)if(Math.abs(k.length-q.length)<6)best=Math.max(best,dice(k,q));
      if(best>0.52){sc=Math.max(sc,Math.round(best*58));why=why||'fuzzy'}
    }
    if(sc===0&&q.length>3){
      for(const L of LANGS)if(r.defs[L].includes(q)){sc=22;why='def';break}
    }
    if(sc>0){
      if(norm(e.t[S.lang])===q)sc+=4;
      if(e.l===1)sc+=1.5;
      out.push({e,sc,why});
    }
  }
  out.sort((a,b)=>b.sc-a.sc||a.e.t.en.localeCompare(b.e.t.en));
  return out;
}
function hl(text,raw){
  const txt=String(text==null?'':text);
  const q=String(raw||'').trim();
  if(q.length<2)return esc(txt);
  const i=txt.toLowerCase().indexOf(q.toLowerCase());
  if(i<0)return esc(txt);
  return esc(txt.slice(0,i))+'<mark>'+esc(txt.slice(i,i+q.length))+'</mark>'+esc(txt.slice(i+q.length));
}
function ac(raw){
  const box=$('#ac'),inp=$('#q');
  if(!raw.trim()){box.hidden=true;inp.setAttribute('aria-expanded','false');return}
  const hits=search(raw,null).slice(0,8);
  if(!hits.length){
    box.innerHTML='<b>'+esc(t().results)+' 0</b><div style="padding:9px 11px" class="small muted">'+esc(t().noResults)+'</div>';
  }else{
    box.innerHTML='<b>'+hits.length+' '+esc(t().results)+'</b>'+hits.map((h,i)=>{
      const e=h.e,other=LANGS.filter(l=>l!==S.lang).map(l=>esc(e.t[l])).join(' · ');
      return '<a href="'+href('term',e.i)+'" role="option"'+(i===0?' class="on"':'')+'>'
        +'<span class="h">'+hl(e.t[S.lang],raw)+'</span> '
        +'<span class="s">'+other+'</span></a>';
    }).join('');
  }
  box.hidden=false;inp.setAttribute('aria-expanded','true');
  box.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{box.hidden=true;inp.value=''}));
}

/* ---------------- router ---------------- */
function route(){
  const h=(location.hash||'').replace(/^#\/?/,'');
  const p=h.split('/').filter(Boolean).map(decodeURIComponent);
  if(p.length&&LANGS.includes(p[0])){
    if(p[0]!==S.lang){S.lang=p[0];applyLang()}
    p.shift();
  }
  const page=p[0]||'home',arg=p[1]||'';
  S.route={page,arg};
  const acb=document.getElementById('ac');
  if(acb){acb.hidden=true;const qi=document.getElementById('q');if(qi)qi.setAttribute('aria-expanded','false')}
  markNav();
  const V=$('#view');
  window.scrollTo(0,0);
  const fn={home:vHome,dict:vDict,cats:vCats,cat:vCat,term:vTerm,search:vSearch,academy:vAcademy,
            calc:vCalc,map:vMap,editorial:vEditorial,about:vAbout,submit:vSubmit}[page]||vHome;
  V.innerHTML='';
  fn(V,arg);
  renderMathIn(V);
  document.title=(S.route.title?S.route.title+' — ':'')+t().brand;
}

/* ---------------- shared bits ---------------- */
function statusChip(sid){
  const tone=toneCls(statusTone(sid));
  return '<span class="chip '+tone+'">'+esc(statusLabel(sid))+'</span>';
}
function termTrio(e,current){
  const rows=[['en','la',t().enTerm],['fa','ar',t().faTerm],['ckb','ck',t().ckbTerm]];
  return '<div class="trio">'+rows.map(([L,cls,lb])=>
    '<div class="one'+(L===current?' cur':'')+'">'
    +'<span class="lb">'+esc(lb)+'</span>'
    +'<span class="hw '+cls+'" lang="'+(L==='ckb'?'ckb':L)+'" dir="'+(L==='en'?'ltr':'rtl')+'">'+esc(e.term?e.term[L]:e.t[L])+'</span>'
    +(L==='en'?'<span class="chip info">reference</span>':statusChip((e.term_status||e.s)[L]))
    +'</div>').join('')+'</div>';
}
function hitRow(e,raw){
  const other=LANGS.filter(l=>l!==S.lang);
  const c=catById(e.c);
  return '<a class="hit" href="'+href('term',e.i)+'">'
    +'<span class="h">'+hl(e.t[S.lang],raw||'')+'</span>'
    +'<span class="alt">'+other.map(l=>esc(e.t[l])).join(' · ')+'</span>'
    +'<span class="d">'+esc(e.d[S.lang])+'</span>'
    +'<span class="row xs" style="margin-top:7px">'
    +'<span class="chip" style="border-color:'+catColor(e.c)+';color:'+catColor(e.c)+'">'+esc(c?c.name[S.lang]:e.c)+'</span>'
    +'<span class="chip lvl">'+esc(lvlLabel(e.l))+'</span>'
    +(e.m?'<span class="chip gold">ƒ</span>':'')
    +'<span class="chip '+(e.e==='author-framework'?'warn':e.e==='needs-expert'?'warn':'')+'">'+esc(stateLabel(e.e))+'</span>'
    +'</span></a>';
}

/* ---------------- view: home ---------------- */
function vHome(V){
  const L=t(),n=S.idx.length;
  const nMath=S.idx.filter(e=>e.m).length;
  const nSrc=Object.values(S.meta.sources).filter(s=>s.url_verified).length;
  const counts={};S.idx.forEach(e=>counts[e.c]=(counts[e.c]||0)+1);
  const feat=['liquidity','body-v','position-sizing','funding-rate','lookahead-bias','impermanent-loss']
    .map(id=>S.idx.find(e=>e.i===id)).filter(Boolean);
  V.innerHTML=
  '<section class="hero">'
   +'<div><p class="eyebrow">'+esc(L.heroEyebrow)+'</p>'
   +'<h1>'+esc(L.heroTitle)+'</h1>'
   +'<p class="lede">'+esc(L.heroLede)+'</p>'
   +'<div class="row" style="margin-top:16px"><a class="btn pri" href="'+href('cats')+'">'+esc(L.browseCats)+'</a>'
   +'<a class="btn" href="'+href('academy')+'">'+esc(L.startLearn)+'</a>'
   +'<a class="btn" href="'+href('calc')+'">'+esc(L.nav.calc)+'</a></div></div>'
   +'<div class="grid" style="gap:10px;grid-template-columns:repeat(auto-fit,minmax(138px,1fr))">'
   +'<div class="stat"><span class="v">'+n+'</span><span class="k">'+esc(L.stTerms)+'</span></div>'
   +'<div class="stat"><span class="v">18</span><span class="k">'+esc(L.stCats)+'</span></div>'
   +'<div class="stat"><span class="v">'+nMath+'</span><span class="k">'+esc(L.stMath)+'</span></div>'
   +'<div class="stat"><span class="v">'+nSrc+'</span><span class="k">'+esc(L.stSrc)+'</span></div>'
   +'<div class="stat" style="grid-column:1/-1"><span class="v">3</span><span class="k">'+esc(L.stLang)+' — English · فارسی · کوردی سۆرانی</span></div>'
   +'</div></section>'
  +'<hr class="rule">'
  +'<h2>'+esc(L.catsTitle)+'</h2><p class="small muted">'+esc(L.catsLede)+'</p>'
  +'<div class="grid g3" style="margin-top:14px">'+S.meta.categories.map(c=>
     '<a class="catcard" href="'+href('cat',c.id)+'" style="border-inline-start:3px solid '+catColor(c.id)+'">'
     +'<span class="n">'+c.id+'</span><h3>'+esc(c.name[S.lang])+'</h3>'
     +'<p>'+esc(c.blurb[S.lang])+'</p>'
     +'<span class="c">'+(counts[c.id]||0)+' '+esc(L.terms)+' · '+c.subs.length+' '+esc(L.sub)+'</span></a>').join('')
  +'</div>'
  +'<hr class="rule">'
  +'<h2>'+esc(L.nav.dict)+'</h2>'
  +'<div style="margin-top:10px">'+feat.map(e=>hitRow(e,'')).join('')+'</div>'
  +'<p style="margin-top:14px"><a class="btn" href="'+href('dict')+'">'+esc(L.dictTitle)+' →</a></p>';
  S.route.title=L.nav.home;
}

/* ---------------- view: dictionary ---------------- */
function vDict(V,arg){
  const L=t();
  const sortKey=lsGet('sort',S.lang);
  V.innerHTML='<h1>'+esc(L.dictTitle)+'</h1><p class="lede">'+esc(L.dictLede)+'</p>'
   +'<div class="row" style="margin:16px 0 8px"><span class="xs muted mono">'+esc(L.sortBy)+':</span>'
   +[['en',L.byEn],['fa',L.byFa],['ckb',L.byCkb],['cat',L.byCat]].map(([k,lb])=>
     '<button class="btn" data-sort="'+k+'"'+(k===sortKey?' style="border-color:var(--gold-2);background:var(--gold-wash)"':'')+'>'+esc(lb)+'</button>').join('')
   +'<span class="top-sp"></span><span class="xs muted mono">'+S.idx.length+' '+esc(L.terms)+'</span></div>'
   +'<div id="dlist"></div>';
  const draw=k=>{
    const list=[...S.idx];
    if(k==='cat')list.sort((a,b)=>a.c.localeCompare(b.c)||a.t.en.localeCompare(b.t.en));
    else list.sort((a,b)=>String(a.t[k]).localeCompare(String(b.t[k]),k==='en'?'en':'fa'));
    let html='',lastGroup=null;
    for(const e of list){
      const g=k==='cat'?e.c:String(e.t[k]).charAt(0).toUpperCase();
      if(g!==lastGroup){
        lastGroup=g;
        const lb=k==='cat'?(catById(g)?catById(g).name[S.lang]:g):g;
        html+='<h3 style="margin:20px 0 4px;font-family:var(--mono);font-size:12px;letter-spacing:.1em;color:var(--gold)">'+esc(lb)+'</h3>';
      }
      html+=hitRow(e,'');
    }
    $('#dlist').innerHTML=html;
  };
  draw(sortKey);
  V.querySelectorAll('[data-sort]').forEach(b=>b.addEventListener('click',()=>{
    lsSet('sort',b.dataset.sort);vDict(V,arg);
  }));
  S.route.title=L.dictTitle;
}

/* ---------------- view: categories ---------------- */
function vCats(V){
  const L=t();const counts={};S.idx.forEach(e=>counts[e.c]=(counts[e.c]||0)+1);
  V.innerHTML='<h1>'+esc(L.catsTitle)+'</h1><p class="lede">'+esc(L.catsLede)+'</p>'
   +'<div class="grid g2" style="margin-top:18px">'+S.meta.categories.map(c=>
     '<div class="card" style="border-inline-start:3px solid '+catColor(c.id)+'">'
     +'<span class="n mono xs" style="color:'+catColor(c.id)+'">'+c.id+'</span>'
     +'<h3 style="margin:4px 0 6px"><a href="'+href('cat',c.id)+'" style="text-decoration:none">'+esc(c.name[S.lang])+'</a></h3>'
     +'<p class="small muted">'+esc(c.blurb[S.lang])+'</p>'
     +'<div class="row xs" style="margin-top:9px">'+c.subs.map(s=>'<span class="chip">'+esc(s.replace(/-/g,' '))+'</span>').join('')+'</div>'
     +'<p class="xs mono muted" style="margin:10px 0 0">'+(counts[c.id]||0)+' '+esc(L.terms)+'</p></div>').join('')
   +'</div>';
  S.route.title=L.catsTitle;
}
function vCat(V,id){
  const L=t(),c=catById(id);
  if(!c){V.innerHTML='<div class="notice">'+esc(L.notFound)+'</div>';return}
  const list=S.idx.filter(e=>e.c===id);
  const bySub={};list.forEach(e=>{(bySub[e.u]=bySub[e.u]||[]).push(e)});
  V.innerHTML='<p class="eyebrow" style="color:'+catColor(id)+'">'+esc(L.cat)+' '+id+'</p>'
   +'<h1>'+esc(c.name[S.lang])+'</h1><p class="lede">'+esc(c.blurb[S.lang])+'</p>'
   +'<p class="xs mono muted">'+list.length+' '+esc(L.terms)+'</p>'
   +c.subs.filter(s=>bySub[s]).map(s=>
     '<div class="sect"><h2>'+esc(s.replace(/-/g,' '))+'</h2>'+bySub[s].map(e=>hitRow(e,'')).join('')+'</div>').join('')
   +Object.keys(bySub).filter(s=>!c.subs.includes(s)).map(s=>
     '<div class="sect"><h2>'+esc(s.replace(/-/g,' '))+'</h2>'+bySub[s].map(e=>hitRow(e,'')).join('')+'</div>').join('');
  S.route.title=c.name[S.lang];
}

/* ---------------- view: search ---------------- */
function vSearch(V,arg){
  const L=t();
  const F=lsGet('filters',{});
  const opt=(v,lb,cur)=>'<option value="'+esc(v)+'"'+(String(cur)===String(v)?' selected':'')+'>'+esc(lb)+'</option>';
  V.innerHTML='<h1>'+esc(L.searchTitle)+'</h1>'
   +'<div style="margin:14px 0"><input id="sq" type="search" value="'+esc(arg||'')+'" placeholder="'+esc(L.search)+'"></div>'
   +'<div class="filters">'
   +'<div><label>'+esc(L.fCat)+'</label><select id="fcat">'+opt('',L.any,F.cat)+S.meta.categories.map(c=>opt(c.id,c.id+' '+c.name[S.lang],F.cat)).join('')+'</select></div>'
   +'<div><label>'+esc(L.fLevel)+'</label><select id="flevel">'+opt('',L.any,F.level)+[1,2,3].map(n=>opt(n,lvlLabel(n),F.level)).join('')+'</select></div>'
   +'<div><label>'+esc(L.fStatus)+'</label><select id="fstate">'+opt('',L.any,F.state)+S.meta.editorial_states.filter(s=>s.id!=='published').map(s=>opt(s.id,s.label[S.lang],F.state)).join('')+'</select></div>'
   +'<div><label>'+esc(L.fMath)+'</label><select id="fmath">'+opt('',L.any,F.math)+opt('1',L.hasMath,F.math)+opt('0',L.noMath,F.math)+'</select></div>'
   +'<div><label>'+esc(L.fLang)+' (ckb)</label><select id="fckb">'+opt('',L.any,F.ckb)+S.meta.term_status.map(s=>opt(s.id,s.label[S.lang],F.ckb)).join('')+'</select></div>'
   +'</div>'
   +'<div id="rc" class="xs mono muted"></div><div id="res"></div>'
   +'<div id="hist" style="margin-top:26px"></div>';
  const run=()=>{
    const q=$('#sq').value;
    const f={cat:$('#fcat').value,level:$('#flevel').value,state:$('#fstate').value,math:$('#fmath').value,ckb:$('#fckb').value};
    lsSet('filters',f);
    const hits=search(q,f);
    $('#rc').textContent=hits.length+' '+L.results;
    $('#res').innerHTML=hits.length?hits.slice(0,180).map(h=>hitRow(h.e,q)).join('')
      :'<div class="notice" style="margin-top:14px">'+esc(L.noResults)+'</div>';
  };
  const hist=()=>{
    const h=lsGet('hist',[]);
    $('#hist').innerHTML=h.length?'<div class="row"><span class="xs mono muted">'+esc(L.recent)+'</span>'
      +h.slice(0,10).map(x=>'<a class="chip" href="'+href('search',x)+'">'+esc(x)+'</a>').join('')
      +'<button class="btn xs" id="ch">'+esc(L.clear)+'</button></div>':'';
    const cb=$('#ch');if(cb)cb.addEventListener('click',()=>{lsSet('hist',[]);hist()});
  };
  ['fcat','flevel','fstate','fmath','fckb'].forEach(id=>$('#'+id).addEventListener('change',run));
  let tm=null;
  $('#sq').addEventListener('input',()=>{clearTimeout(tm);tm=setTimeout(run,140)});
  $('#sq').addEventListener('change',()=>{
    const v=$('#sq').value.trim();if(!v)return;
    const h=lsGet('hist',[]).filter(x=>x!==v);h.unshift(v);lsSet('hist',h.slice(0,12));hist();
  });
  run();hist();
  if(arg){const h=lsGet('hist',[]).filter(x=>x!==arg);h.unshift(arg);lsSet('hist',h.slice(0,12));hist()}
  S.route.title=L.searchTitle;
}

/* ---------------- view: term ---------------- */
function vTerm(V,id){
  const L=t(),light=S.idx.find(x=>x.i===id);
  if(!light){V.innerHTML='<div class="notice">'+esc(L.notFound)+'</div>';return}
  const e=getFull(id);
  S.route.title=light.t[S.lang];
  if(!e){
    V.innerHTML=head()+'<div class="card"><p>'+esc(light.d[S.lang])+'</p>'
      +'<p class="xs mono muted">'+esc(L.loading)+'</p><div class="skel" style="width:80%"></div>'
      +'<div class="skel" style="width:62%;margin-top:8px"></div></div>';
    loadShard(light.c).then(()=>{
      if(S.route.page==='term'&&S.route.arg===id){V.innerHTML='';vTerm(V,id);renderMathIn(V)}
    }).catch(()=>{
      V.innerHTML=head()+'<div class="notice">'+esc(L.notFound)+'</div>';
    });
    return;
  }
  const c=catById(e.cat);
  const depth=S.depth||'simple';
  const depths=[['simple',L.simple],['pro',L.pro],['technical',L.technical]].concat(S.lang==='en'?[['academic',L.academic]]:[]);
  const P=e.practice[S.lang]||e.practice.en;
  V.innerHTML=head()
  +'<div class="depth" role="tablist">'+depths.map(([k,lb])=>
     '<button role="tab" data-d="'+k+'" aria-selected="'+(k===depth)+'">'+esc(lb)+'</button>').join('')+'</div>'
  +'<div class="defbody" id="defbody">'+defText(e,depth)+'</div>'
  +sect(L.mechanism,'<p class="measure">'+esc(e.mechanism[S.lang]||e.mechanism.en)+'</p>')
  +sect(L.practice,
     '<div class="grid g2">'
     +pcard(L.who,P.who)+pcard(L.why,P.why)
     +'</div>'
     +'<div class="grid g2" style="margin-top:12px">'
     +pcard(L.limits,P.limits,'warn')
     +'<div class="card"><span class="lb xs mono muted" style="letter-spacing:.09em;text-transform:uppercase">'+esc(L.mistakes)+'</span>'
     +'<ul style="margin:8px 0 0;padding-inline-start:18px;font-size:14px">'+(P.mistakes||[]).map(m=>'<li>'+esc(m)+'</li>').join('')+'</ul></div>'
     +'</div>')
  +sect(L.examples,'<div class="grid g2">'+(e.examples||[]).map(x=>
     '<div class="ex"><span class="k">'+esc(x.kind)+'</span><p style="margin:0">'+esc(x.text[S.lang]||x.text.en)+'</p>'
     +(x.calc?'<div class="calc">'
        +'<b class="xs mono">'+esc(L.given)+'</b><ul>'+(x.calc.given||[]).map(g=>'<li class="mono">'+esc(g)+'</li>').join('')+'</ul>'
        +'<b class="xs mono">'+esc(L.steps)+'</b><ol>'+(x.calc.steps||[]).map(g=>'<li class="mono">'+esc(g)+'</li>').join('')+'</ol>'
        +'<span class="res">'+esc(x.calc.result||'')+'</span>'
        +(x.calc.note?'<p class="xs muted" style="margin:7px 0 0">'+esc(x.calc.note)+'</p>':'')
      +'</div>':'')
     +'</div>').join('')+'</div>')
  +(e.math?mathBlock(e.math):'')
  +relBlock(e)
  +srcBlock(e)
  +edBlock(e);
  V.querySelectorAll('.depth button').forEach(b=>b.addEventListener('click',()=>{
    S.depth=b.dataset.d;
    V.querySelectorAll('.depth button').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.d===S.depth)));
    $('#defbody').innerHTML=defText(e,S.depth);
  }));

  function head(){
    const o=e||light;
    const cat=catById(o.cat||o.c);
    const meta=[];
    if(cat)meta.push([L.cat,'<a href="'+href('cat',cat.id)+'" style="color:'+catColor(cat.id)+'">'+esc(cat.name[S.lang])+'</a>']);
    meta.push([L.sub,esc(String(o.sub||o.u).replace(/-/g,' '))]);
    meta.push([L.level,esc(lvlLabel(o.level||o.l))]);
    if(o.pron)meta.push([L.pron,'<span class="mono">'+esc(o.pron)+'</span>']);
    const ab=(o.abbr||o.a||[]);if(ab.length)meta.push([L.abbr,'<span class="mono">'+ab.map(esc).join(', ')+'</span>']);
    if(o.aka&&o.aka[S.lang]&&o.aka[S.lang].length)meta.push([L.aka,o.aka[S.lang].map(esc).join(' · ')]);
    return '<nav class="xs mono muted" style="margin-bottom:10px"><a href="'+href('cats')+'">'+esc(L.nav.cats)+'</a> / '
      +(cat?'<a href="'+href('cat',cat.id)+'">'+esc(cat.name[S.lang])+'</a>':'')+'</nav>'
      +'<div class="termhead"><h1>'+esc((o.term||o.t)[S.lang])
      +(S.lang!=='en'?' <span class="muted" style="font-size:.56em;font-family:var(--serif);font-weight:400" dir="ltr">'+esc((o.term||o.t).en)+'</span>':'')+'</h1>'
      +termTrio(o,S.lang)
      +'<dl class="kv" style="margin-top:14px">'+meta.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+v+'</dd>').join('')+'</dl>'
      +'</div>';
  }
  function defText(en,d){
    if(d==='academic')return '<p>'+esc(en.def.en.academic||'')+'</p>';
    const o=en.def[S.lang]||en.def.en;
    return '<p>'+esc(o[d]||'')+'</p>';
  }
  function pcard(lb,val,tone){
    return '<div class="card"'+(tone==='warn'?' style="border-color:color-mix(in srgb,var(--warn) 32%,transparent);background:var(--warn-wash)"':'')+'>'
      +'<span class="xs mono muted" style="letter-spacing:.09em;text-transform:uppercase">'+esc(lb)+'</span>'
      +'<p style="margin:7px 0 0;font-size:14.5px">'+esc(val||'')+'</p></div>';
  }
}
function sect(title,body){return '<div class="sect"><h2>'+esc(title)+'</h2>'+body+'</div>'}

function mathBlock(m){
  const L=t();
  return '<div class="sect"><h2>'+esc(L.math)+'</h2><div class="math">'
   +'<div class="mathline" data-tex="'+esc(m.latex)+'" data-display></div>'
   +'<h3 style="font-size:13px;margin-top:12px">'+esc(L.vars)+'</h3>'
   +'<div class="scrollx"><table class="t"><thead><tr><th>sym</th><th>'+esc(L.vars)+'</th><th>unit</th></tr></thead><tbody>'
   +(m.vars||[]).map(v=>'<tr><td><span data-tex="'+esc(v.sym)+'"></span></td><td>'+esc(v[S.lang]||v.en)+'</td><td class="xs mono muted">'+esc(v.unit||'')+'</td></tr>').join('')
   +'</tbody></table></div>'
   +(m.procedure?'<h3 style="font-size:13px;margin-top:14px">'+esc(L.procedure)+'</h3><p class="small" style="margin:5px 0 0">'+esc(m.procedure[S.lang]||m.procedure.en)+'</p>':'')
   +(m.worked?'<h3 style="font-size:13px;margin-top:14px">'+esc(L.worked)+'</h3><div class="calc" style="border-top:0;padding-top:0">'
      +'<b class="xs mono">'+esc(L.given)+'</b><ul>'+(m.worked.given||[]).map(g=>'<li class="mono">'+esc(g)+'</li>').join('')+'</ul>'
      +'<b class="xs mono">'+esc(L.steps)+'</b><ol>'+(m.worked.steps||[]).map(g=>'<li class="mono">'+esc(g)+'</li>').join('')+'</ol>'
      +'<span class="res">'+esc(m.worked.result||'')+'</span></div>':'')
   +(m.interpretation?'<h3 style="font-size:13px;margin-top:14px">'+esc(L.interp)+'</h3><p class="small" style="margin:5px 0 0">'+esc(m.interpretation[S.lang]||m.interpretation.en)+'</p>':'')
   +((m.assumptions||[]).length?'<h3 style="font-size:13px;margin-top:14px">'+esc(L.assumptions)+'</h3><ul class="small" style="margin:5px 0 0;padding-inline-start:18px">'+m.assumptions.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':'')
   +((m.limits||[]).length?'<div class="warnbox"><b class="xs mono">'+esc(L.mlimits)+'</b><ul style="margin:6px 0 0;padding-inline-start:18px">'+m.limits.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul></div>':'')
   +'</div></div>';
}
function relBlock(e){
  const L=t(),r=e.relations||{},out=[];
  const links=ids=>(ids||[]).map(id=>{const x=S.idx.find(y=>y.i===id);
    return x?'<a href="'+href('term',id)+'">'+esc(x.t[S.lang])+'</a>':''}).join('');
  if(r.parent)out.push([L.parent,links([r.parent])]);
  if((r.children||[]).length)out.push([L.children,links(r.children)]);
  if((r.synonyms||[]).length)out.push([L.synonyms,links(r.synonyms)]);
  if((r.antonyms||[]).length)out.push([L.antonyms,links(r.antonyms)]);
  if((r.related||[]).length)out.push([L.related,links(r.related)]);
  let cw='';
  if((r.confused_with||[]).length){
    cw='<div class="grid g2" style="margin-top:12px">'+r.confused_with.map(c=>{
      const x=S.idx.find(y=>y.i===c.id);
      return '<div class="card"><span class="xs mono muted" style="text-transform:uppercase;letter-spacing:.09em">'+esc(L.confused)+'</span>'
        +'<h3 style="margin:5px 0 6px;font-size:15px">'+(x?'<a href="'+href('term',c.id)+'" style="text-decoration:none">'+esc(x.t[S.lang])+'</a>':esc(c.id))+'</h3>'
        +'<p class="small" style="margin:0">'+esc(c.note[S.lang]||c.note.en)+'</p></div>'}).join('')+'</div>';
  }
  if(!out.length&&!cw)return '';
  return '<div class="sect"><h2>'+esc(L.relations)+'</h2>'
   +'<dl class="kv rel">'+out.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+v+'</dd>').join('')+'</dl>'+cw
   +'<p style="margin-top:12px"><a class="btn" href="'+href('map',e.id)+'">'+esc(L.neighbourhood)+' →</a></p></div>';
}
function srcBlock(e){
  const L=t();
  return '<div class="sect"><h2>'+esc(L.sources)+'</h2>'
   +(e.sources||[]).map(s=>{
     const r=S.meta.sources[s.sid];
     if(!r)return '<div class="src"><span class="chip bad">unknown source id: '+esc(s.sid)+'</span></div>';
     return '<div class="src"><span class="ti">'+esc(r.title)+'</span>'
      +(r.author?' <span class="muted">— '+esc(r.author)+'</span>':'')
      +'<br><span class="xs muted">'+esc(r.org||'')+(r.date?' · '+esc(r.date):'')+(s.locator?' · '+esc(s.locator):'')+'</span><br>'
      +(r.url?'<a class="xs" href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.url)+'</a> <span class="chip good xs">'+esc(L.verified)+'</span>'
            :'<span class="chip xs">'+esc(L.unverified)+'</span>')
      +(r.note?'<p class="xs muted" style="margin:5px 0 0">'+esc(r.note)+'</p>':'')
      +'</div>'}).join('')
   +'</div>';
}
function edBlock(e){
  const L=t(),ed=e.editorial||{},st=S.meta.editorial_states.find(x=>x.id===ed.state);
  const g=ed.gates||{};
  const gl=[[L.gLang,g.language],[L.gFin,g.finance],[L.gCross,g.cross_language],[L.gSrc,g.sources]];
  return '<div class="sect"><h2>'+esc(L.editorialPanel)+'</h2><div class="card">'
   +'<div class="row"><span class="chip '+(ed.state==='author-framework'||ed.state==='needs-expert'?'warn':'')+'">'+esc(stateLabel(ed.state))+'</span>'
   +'<span class="chip info">'+esc(ed.claim_type||'')+'</span>'
   +'<span class="chip mono">v'+esc(ed.version||'')+'</span>'
   +'<span class="chip mono">'+esc(ed.updated||'')+'</span></div>'
   +(st?'<p class="small muted" style="margin:10px 0 0">'+esc(st.desc[S.lang])+'</p>':'')
   +'<div style="margin-top:12px"><span class="xs mono muted" style="text-transform:uppercase;letter-spacing:.09em">'+esc(L.gates)+'</span>'
   +'<div class="gates" style="margin-top:6px">'+gl.map(([k,v])=>'<span class="pill">'+esc(k)+': '+esc(v||'pending')+'</span>').join('')+'</div></div>'
   +(ed.notes?'<div class="notice" style="margin-top:13px">'+esc(ed.notes)+'</div>':'')
   +((ed.history||[]).length?'<div class="scrollx" style="margin-top:13px"><table class="t"><tbody>'
      +ed.history.map(h=>'<tr><td class="mono xs">v'+esc(h.v)+'</td><td class="mono xs">'+esc(h.date)+'</td><td class="xs">'+esc(h.by)+'</td><td class="xs">'+esc(h.note)+'</td></tr>').join('')
      +'</tbody></table></div>':'')
   +'<p style="margin:14px 0 0"><a class="btn xs" href="'+href('submit')+'">'+esc(L.submitTitle)+'</a></p>'
   +'</div></div>';
}

/* ================= CALCULATORS =================
   Every compute() is a pure function of its input object and is unit-tested
   in tests/calc.test.js against hand-computed values. */
const N=v=>{const x=typeof v==='number'?v:parseFloat(String(v).replace(/[٠-٩۰-۹]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)>=0?'٠١٢٣٤٥٦٧٨٩'.indexOf(d):'۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/,/g,''));return isFinite(x)?x:NaN};
const nums=s=>String(s==null?'':s).split(/[,\s;]+/).map(x=>N(x)).filter(x=>isFinite(x));
const r2=(x,d)=>{const p=Math.pow(10,d==null?2:d);return Math.round(x*p)/p};
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function sd(a){ // sample standard deviation, n-1
  if(a.length<2)return NaN;const m=mean(a);
  return Math.sqrt(a.reduce((s,x)=>s+(x-m)*(x-m),0)/(a.length-1));
}
const L3=(en,fa,ckb)=>({en,fa,ckb});
const CALC={
 'position-size':{n:L3('Position size','اندازهٔ پوزیشن','قەبارەی پۆزیشن'),term:'position-sizing',
  tex:'Q=\\frac{E\\cdot r}{|P_{entry}-P_{stop}|}',
  f:[['equity',L3('Account equity','سرمایهٔ حساب','سەرمایەی هەژمار'),20000],
     ['riskPct',L3('Risk per trade (%)','ریسک هر معامله (٪)','مەترسی هەر مامەڵە (٪)'),1],
     ['entry',L3('Entry price','قیمت ورود','نرخی چوونەژوورەوە'),100],
     ['stop',L3('Stop price','قیمت حد ضرر','نرخی سنووری زیان'),95.6]],
  c:v=>{const d=Math.abs(v.entry-v.stop);if(!(d>0))return{v:NaN,u:'',x:'stop must differ from entry'};
    const q=v.equity*v.riskPct/100/d;
    return{v:r2(q,4),u:L3('units','واحد','یەکە'),x:'risk amount = '+r2(v.equity*v.riskPct/100,2)+' · stop distance = '+r2(d,4)+' · notional = '+r2(q*v.entry,2)}},
  a:[L3('Risk is measured to the stop price only; a gap can exceed it.','ریسک فقط تا قیمت حد ضرر سنجیده شده؛ گپ قیمتی می‌تواند از آن بگذرد.','مەترسی تەنها تا نرخی سنووری زیان پێوراوە؛ بۆشایی نرخ دەتوانێت لێی تێپەڕێت.'),
     L3('Fees, funding and slippage are excluded and widen the effective stop distance.','کارمزد، فاندینگ و لغزش لحاظ نشده‌اند و فاصلهٔ مؤثر حد ضرر را بیشتر می‌کنند.','کرێ، فاندینگ و خلیسکان لەبەرچاو نەگیراون و دووری کاریگەری سنووری زیان زیاد دەکەن.')],
  l:[L3('A correct size does not make a bad entry profitable.','اندازهٔ درست، ورود بد را سودده نمی‌کند.','قەبارەی دروست، چوونەژوورەوەی خراپ قازانجدار ناکات.')]},

 'risk-reward':{n:L3('Risk / reward','ریسک به ریوارد','مەترسی بۆ قازانج'),term:'risk-reward-ratio',
  tex:'R=\\frac{|P_{target}-P_{entry}|}{|P_{entry}-P_{stop}|},\\quad w_{BE}=\\frac{1}{1+R}',
  f:[['entry',L3('Entry','ورود','چوونەژوورەوە'),100],
     ['stop',L3('Stop','حد ضرر','سنووری زیان'),96],
     ['target',L3('Target','هدف','ئامانج'),112]],
  c:v=>{const risk=Math.abs(v.entry-v.stop),rew=Math.abs(v.target-v.entry);
    if(!(risk>0))return{v:NaN,u:'',x:'stop must differ from entry'};
    const R=rew/risk;return{v:r2(R,3),u:':1',x:'break-even win rate = '+r2(100/(1+R),2)+'% · risk '+r2(risk,4)+' · reward '+r2(rew,4)}},
  a:[L3('Assumes the stop and target are both reachable and actually honoured.','فرض می‌کند حد ضرر و هدف هر دو قابل‌دسترسی‌اند و واقعاً رعایت می‌شوند.','گریمانە دەکات سنووری زیان و ئامانج هەردووکیان گەیشتنیان پێ دەکرێت و بەڕاستی پەیڕەو دەکرێن.')],
  l:[L3('A high R with a low win rate can still lose; R and win rate must be measured together.','R بالا با نرخ برد پایین هم می‌تواند ضررده باشد؛ R و نرخ برد باید با هم سنجیده شوند.','Rی بەرز لەگەڵ ڕێژەی سەرکەوتنی نزم هێشتا دەتوانێت زیان بدات؛ هەردووک پێکەوە دەبێت بپێورێن.')]},

 'pnl':{n:L3('Profit and loss','سود و زیان','قازانج و زیان'),term:'long-and-short',
  tex:'PnL_{net}=s\\,(P_{exit}-P_{entry})\\,Q-(P_{entry}+P_{exit})\\,Q\\,f',
  f:[['side',L3('Side: 1 long, -1 short','سمت: ۱ لانگ، −۱ شورت','لا: ١ لۆنگ، −١ شۆرت'),1],
     ['entry',L3('Entry','ورود','چوونەژوورەوە'),100],
     ['exit',L3('Exit','خروج','دەرچوون'),108],
     ['size',L3('Size (units)','حجم (واحد)','قەبارە (یەکە)'),10],
     ['feePct',L3('Fee per side (%)','کارمزد هر سمت (٪)','کرێی هەر لایەک (٪)'),0.05]],
  c:v=>{const s=v.side>=0?1:-1;const gross=s*(v.exit-v.entry)*v.size;
    const fees=(v.entry+v.exit)*v.size*v.feePct/100;
    return{v:r2(gross-fees,4),u:L3('quote currency','ارز مظنه','دراوی نرخ'),
      x:'gross = '+r2(gross,4)+' · fees = '+r2(fees,4)+' · return on notional = '+r2((gross-fees)/(v.entry*v.size)*100,3)+'%'}},
  a:[L3('Linear contract, one entry and one exit, no funding and no partial fills.','قرارداد خطی، یک ورود و یک خروج، بدون فاندینگ و بدون پرشدن جزئی.','گرێبەستی هێڵی، یەک چوونەژوورەوە و یەک دەرچوون، بێ فاندینگ و بێ پڕکردنی بەشەکی.')],
  l:[L3('Inverse contracts and funding payments change the result materially.','قراردادهای معکوس و پرداخت‌های فاندینگ نتیجه را به‌طور معنادار تغییر می‌دهند.','گرێبەستی پێچەوانە و پارەدانی فاندینگ ئەنجام بەشێوەیەکی بەرچاو دەگۆڕن.')]},

 'compound':{n:L3('Compound interest','بهرهٔ مرکب','سووی لێکدراو'),term:'expected-value',
  tex:'A=P\\left(1+\\frac{r}{n}\\right)^{nt}',
  f:[['p',L3('Principal','اصل سرمایه','سەرمایەی سەرەکی'),1000],
     ['ratePct',L3('Annual rate (%)','نرخ سالانه (٪)','ڕێژەی ساڵانە (٪)'),8],
     ['years',L3('Years','سال','ساڵ'),10],
     ['n',L3('Compounds per year','دفعات ترکیب در سال','جاری لێکدان لە ساڵێک'),12]],
  c:v=>{const A=v.p*Math.pow(1+v.ratePct/100/v.n,v.n*v.years);
    return{v:r2(A,2),u:'',x:'growth = '+r2(A-v.p,2)+' · total return = '+r2((A/v.p-1)*100,2)+'%'}},
  a:[L3('Nominal rate, no tax, no fees, no withdrawals.','نرخ اسمی، بدون مالیات، کارمزد و برداشت.','ڕێژەی ناوی، بێ باج، بێ کرێ و بێ دەرهێنان.')],
  l:[L3('Real purchasing power needs the inflation rate subtracted.','قدرت خرید واقعی نیازمند کسر نرخ تورم است.','هێزی کڕینی ڕاستەقینە پێویستی بە کەمکردنەوەی ڕێژەی هەڵاوسانە.')]},

 'leverage':{n:L3('Leverage exposure','اهرم و اندازهٔ پوزیشن','لیڤەرج و قەبارە'),term:'leverage',
  tex:'Notional=E\\cdot L,\\qquad Q=\\frac{E\\cdot L}{P}',
  f:[['equity',L3('Margin committed','مارجین اختصاص‌یافته','مارجینی تەرخانکراو'),1000],
     ['lev',L3('Leverage (x)','اهرم (برابر)','لیڤەرج (جار)'),10],
     ['price',L3('Price','قیمت','نرخ'),100]],
  c:v=>{const not=v.equity*v.lev;
    return{v:r2(not,2),u:L3('notional','ارزش اسمی','بەهای ناوی'),
      x:'units = '+r2(not/v.price,6)+' · an adverse move of '+r2(100/v.lev,3)+'% wipes out the margin before fees'}},
  a:[L3('Isolated margin, linear contract, fees and funding excluded.','مارجین ایزوله، قرارداد خطی، بدون کارمزد و فاندینگ.','مارجینی تەنیا، گرێبەستی هێڵی، بێ کرێ و فاندینگ.')],
  l:[L3('Leverage multiplies loss exactly as it multiplies gain.','اهرم ضرر را دقیقاً به همان نسبت سود چند برابر می‌کند.','لیڤەرج زیان بە هەمان ڕێژەی قازانج چەند ئەوەندە دەکات.')]},

 'margin':{n:L3('Margin requirement','الزام مارجین','داواکاری مارجین'),term:'margin',
  tex:'IM=\\frac{Notional}{L},\\qquad MM=Notional\\cdot m',
  f:[['notional',L3('Notional value','ارزش اسمی','بەهای ناوی'),10000],
     ['lev',L3('Leverage (x)','اهرم (برابر)','لیڤەرج (جار)'),10],
     ['mmrPct',L3('Maintenance margin rate (%)','نرخ مارجین نگهداری (٪)','ڕێژەی مارجینی پاراستن (٪)'),0.5]],
  c:v=>{const im=v.notional/v.lev,mm=v.notional*v.mmrPct/100;
    return{v:r2(im,2),u:L3('initial margin','مارجین اولیه','مارجینی سەرەتایی'),
      x:'maintenance margin = '+r2(mm,2)+' · buffer before liquidation = '+r2(im-mm,2)}},
  a:[L3('Flat maintenance rate. Real venues use tiered rates that rise with position size.','نرخ نگهداری ثابت. صرافی‌های واقعی نرخ پله‌ای دارند که با اندازهٔ پوزیشن بالا می‌رود.','ڕێژەی پاراستنی جێگیر. مەڵبەندەکانی ڕاستەقینە ڕێژەی پلەیی بەکاردەهێنن کە لەگەڵ قەبارە بەرز دەبێتەوە.')],
  l:[L3('Regulated equity margin follows Reg T and FINRA rules, not this formula.','مارجین سهام تحت نظارت از قواعد Reg T و FINRA پیروی می‌کند، نه این فرمول.','مارجینی پشکی ڕێکخراو بەدوای یاساکانی Reg T و FINRA دەکەوێت، نەک ئەم فۆرموڵە.')]},

 'liquidation':{n:L3('Liquidation price','قیمت لیکوئید شدن','نرخی لیکویدکردن'),term:'liquidation',
  tex:'P_{liq}^{long}=P\\frac{1-\\frac{1}{L}}{1-m},\\qquad P_{liq}^{short}=P\\frac{1+\\frac{1}{L}}{1+m}',
  f:[['side',L3('Side: 1 long, -1 short','سمت: ۱ لانگ، −۱ شورت','لا: ١ لۆنگ، −١ شۆرت'),1],
     ['entry',L3('Entry price','قیمت ورود','نرخی چوونەژوورەوە'),100],
     ['lev',L3('Leverage (x)','اهرم (برابر)','لیڤەرج (جار)'),10],
     ['mmrPct',L3('Maintenance margin rate (%)','نرخ مارجین نگهداری (٪)','ڕێژەی مارجینی پاراستن (٪)'),0.5]],
  c:v=>{const m=v.mmrPct/100;
    const p=v.side>=0?v.entry*(1-1/v.lev)/(1-m):v.entry*(1+1/v.lev)/(1+m);
    return{v:r2(p,4),u:'',x:'adverse move to liquidation = '+r2(Math.abs(p-v.entry)/v.entry*100,3)+'%'}},
  a:[L3('Isolated margin, linear contract, flat maintenance rate, fees and funding excluded, mark price equal to last price.','مارجین ایزوله، قرارداد خطی، نرخ نگهداری ثابت، بدون کارمزد و فاندینگ، قیمت مارک برابر آخرین قیمت.','مارجینی تەنیا، گرێبەستی هێڵی، ڕێژەی پاراستنی جێگیر، بێ کرێ و فاندینگ، نرخی مارک یەکسان بە دوا نرخ.'),
     L3('An approximation. Each venue has its own exact rule, insurance fund and partial-liquidation logic.','یک تقریب است. هر صرافی قاعدهٔ دقیق، صندوق بیمه و منطق لیکوئید جزئی خود را دارد.','نزیکەییەکە. هەر مەڵبەندێک یاسای ورد، سندوقی دڵنیایی و لۆژیکی لیکویدکردنی بەشەکی خۆی هەیە.')],
  l:[L3('Never size a position assuming the liquidation price is a stop loss.','هرگز اندازهٔ پوزیشن را با این فرض نبندید که قیمت لیکوئید همان حد ضرر است.','هیچ کات قەبارەی پۆزیشن بەو گریمانەیە دامەنێ کە نرخی لیکویدکردن هەمان سنووری زیانە.')]},

 'pip-value':{n:L3('Pip value','ارزش پیپ','بەهای پیپ'),term:'bid-ask-spread',
  tex:'V_{pip}=\\frac{Q\\cdot \\Delta_{pip}}{X}',
  f:[['units',L3('Units of base currency','واحد ارز پایه','یەکەی دراوی بنەڕەت'),100000],
     ['pip',L3('Pip size','اندازهٔ پیپ','قەبارەی پیپ'),0.0001],
     ['x',L3('Quote-to-account rate (1 if same)','نرخ تبدیل مظنه به حساب (۱ اگر یکی باشد)','ڕێژەی گۆڕینی نرخ بۆ هەژمار (١ ئەگەر یەک بن)'),1]],
  c:v=>{if(!(v.x>0))return{v:NaN,u:'',x:'rate must be positive'};
    const p=v.units*v.pip/v.x;
    return{v:r2(p,4),u:L3('per pip','به ازای هر پیپ','بۆ هەر پیپ'),x:'10 pips = '+r2(p*10,4)+' · 100 pips = '+r2(p*100,4)}},
  a:[L3('JPY pairs use a pip of 0.01, not 0.0001.','جفت‌های ین از پیپ ۰٫۰۱ استفاده می‌کنند نه ۰٫۰۰۰۱.','جووتەکانی یەن پیپی ٠.٠١ بەکاردەهێنن نەک ٠.٠٠٠١.')],
  l:[L3('Crypto venues usually quote in price units, not pips.','صرافی‌های کریپتو معمولاً به واحد قیمت مظنه می‌دهند نه پیپ.','مەڵبەندەکانی کریپتۆ زۆرتر بە یەکەی نرخ نرخ دەدەن نەک پیپ.')]},

 'funding':{n:L3('Funding cost','هزینهٔ فاندینگ','تێچووی فاندینگ'),term:'funding-rate',
  tex:'C=Notional\\cdot f\\cdot k\\cdot d',
  f:[['notional',L3('Notional value','ارزش اسمی','بەهای ناوی'),10000],
     ['ratePct',L3('Funding rate per interval (%)','نرخ فاندینگ هر دوره (٪)','ڕێژەی فاندینگ بۆ هەر خول (٪)'),0.01],
     ['k',L3('Intervals per day','تعداد دوره در روز','ژمارەی خول لە ڕۆژێک'),3],
     ['days',L3('Days held','روزهای نگهداری','ڕۆژانی هەڵگرتن'),7]],
  c:v=>{const c=v.notional*v.ratePct/100*v.k*v.days;
    return{v:r2(c,4),u:L3('paid if positive','اگر مثبت باشد پرداخت می‌کنید','ئەگەر ئەرێنی بێت تۆ دەدەیت'),
      x:'annualised at this rate = '+r2(v.ratePct*v.k*365,2)+'% of notional'}},
  a:[L3('A constant rate is assumed. Real funding changes every interval and can flip sign.','نرخ ثابت فرض شده. فاندینگ واقعی هر دوره تغییر می‌کند و می‌تواند علامتش عوض شود.','ڕێژەیەکی جێگیر گریمانە کراوە. فاندینگی ڕاستەقینە هەر خولێک دەگۆڕێت و دەتوانێت ئاماژەی بگۆڕێت.'),
     L3('Interval length, caps and the premium-index method are venue-specific.','طول دوره، سقف‌ها و روش شاخص پریمیوم مخصوص هر صرافی است.','درێژی خول، سنوورەکان و ڕێبازی پێوەری پریمیۆم تایبەتن بە هەر مەڵبەند.')],
  l:[L3('Positive funding is a running cost on a long and a running income on a short.','فاندینگ مثبت برای لانگ هزینهٔ جاری و برای شورت درآمد جاری است.','فاندینگی ئەرێنی بۆ لۆنگ تێچووی بەردەوام و بۆ شۆرت داهاتی بەردەوامە.')]},

 'avg-entry':{n:L3('Average entry price','قیمت میانگین ورود','نرخی تێکڕای چوونەژوورەوە'),term:'dollar-cost-averaging',
  tex:'\\bar P=\\frac{\\sum P_i Q_i}{\\sum Q_i}',
  f:[['prices',L3('Prices (comma separated)','قیمت‌ها (با کاما)','نرخەکان (بە کۆما)'),'100, 90, 80'],
     ['qtys',L3('Quantities (comma separated)','مقادیر (با کاما)','بڕەکان (بە کۆما)'),'1, 1, 2']],
  c:v=>{const p=nums(v.prices),q=nums(v.qtys);
    if(!p.length||p.length!==q.length)return{v:NaN,u:'',x:'prices and quantities must have the same count'};
    const tq=q.reduce((s,x)=>s+x,0);if(!(tq>0))return{v:NaN,u:'',x:'total quantity must be positive'};
    const cost=p.reduce((s,x,i)=>s+x*q[i],0);
    return{v:r2(cost/tq,6),u:'',x:'total quantity = '+r2(tq,6)+' · total cost = '+r2(cost,4)}},
  a:[L3('Quantities are in units of the asset, not in quote currency.','مقادیر به واحد دارایی است نه ارز مظنه.','بڕەکان بە یەکەی سامانن نەک بە دراوی نرخ.')],
  l:[L3('Averaging down into a falling asset increases exposure, it does not reduce risk.','میانگین‌گیری در دارایی ریزشی، ریسک را کم نمی‌کند بلکه اندازهٔ ریسک را بیشتر می‌کند.','تێکڕاکردن لە سامانێکی داشکاو مەترسی کەم ناکات بەڵکو قەبارەی مەترسی زیاد دەکات.')]},

 'dca':{n:L3('DCA average cost','میانگین هزینهٔ خرید پله‌ای','تێکڕای تێچووی کڕینی پلەیی'),term:'dollar-cost-averaging',
  tex:'\\bar P=\\frac{n\\,A}{\\sum \\frac{A}{P_i}}=\\text{harmonic mean}(P_i)',
  f:[['amount',L3('Fixed amount each period','مبلغ ثابت هر دوره','بڕی جێگیری هەر خولێک'),100],
     ['prices',L3('Prices (comma separated)','قیمت‌ها (با کاما)','نرخەکان (بە کۆما)'),'80, 100, 150']],
  c:v=>{const p=nums(v.prices).filter(x=>x>0);
    if(!p.length)return{v:NaN,u:'',x:'at least one positive price is needed'};
    const units=p.reduce((s,x)=>s+v.amount/x,0);
    const avg=p.length*v.amount/units;
    return{v:r2(avg,6),u:'',x:'units acquired = '+r2(units,6)+' · invested = '+r2(v.amount*p.length,2)
      +' · arithmetic mean price = '+r2(mean(p),4)+' (always ≥ the DCA average)'}},
  a:[L3('A fixed amount of quote currency is bought at each price, with no fees.','در هر قیمت مبلغ ثابتی از ارز مظنه خریداری می‌شود، بدون کارمزد.','لە هەر نرخێکدا بڕێکی جێگیر لە دراوی نرخ دەکڕدرێت، بێ کرێ.')],
  l:[L3('The harmonic mean is below the arithmetic mean by construction; that is arithmetic, not an edge.','میانگین هارمونیک به‌طور ساختاری از میانگین حسابی کمتر است؛ این ریاضیات است نه برتری معاملاتی.','تێکڕای هارمۆنیک بە پێکهاتە لە تێکڕای ژمێریاری کەمترە؛ ئەمە ژمێریارییە نەک برایی مامەڵە.')]},

 'allocation':{n:L3('Portfolio allocation','تخصیص پرتفوی','دابەشکردنی پۆرتفۆلیۆ'),term:'asset-allocation',
  tex:'A_i=V\\cdot\\frac{w_i}{\\sum w_j}',
  f:[['total',L3('Total capital','سرمایهٔ کل','سەرمایەی گشتی'),10000],
     ['weights',L3('Weights (comma separated)','وزن‌ها (با کاما)','کێشەکان (بە کۆما)'),'50, 30, 20']],
  c:v=>{const w=nums(v.weights);const sum=w.reduce((s,x)=>s+x,0);
    if(!(sum>0))return{v:NaN,u:'',x:'weights must sum to more than zero'};
    const parts=w.map(x=>r2(v.total*x/sum,2));
    return{v:parts[0],u:L3('first bucket','سبد اول','سەبەتەی یەکەم'),
      x:'allocation = '+parts.join(' / ')+(Math.abs(sum-100)>0.01?' · weights summed to '+r2(sum,2)+', normalised to 100':'')}},
  a:[L3('Weights are normalised, so they need not sum to 100.','وزن‌ها نرمال می‌شوند، پس لازم نیست مجموعشان ۱۰۰ باشد.','کێشەکان ستانداردکراون، بۆیە پێویست نییە کۆیان ١٠٠ بێت.')],
  l:[L3('Allocation is not diversification if the holdings move together.','اگر دارایی‌ها با هم حرکت کنند، تخصیص همان تنوع‌بخشی نیست.','ئەگەر سامانەکان پێکەوە بجوڵێن، دابەشکردن هەمان جۆراوجۆرکردن نییە.')]},

 'roi':{n:L3('Return on investment','بازدهی سرمایه‌گذاری','قازانجی وەبەرهێنان'),term:'expected-value',
  tex:'ROI=\\frac{V_1-V_0}{V_0}\\times 100',
  f:[['v0',L3('Initial value','ارزش اولیه','بەهای سەرەتایی'),1000],
     ['v1',L3('Final value','ارزش نهایی','بەهای کۆتایی'),1450]],
  c:v=>{if(!(v.v0!==0))return{v:NaN,u:'',x:'initial value cannot be zero'};
    const roi=(v.v1-v.v0)/v.v0*100;
    return{v:r2(roi,3),u:'%',x:'profit = '+r2(v.v1-v.v0,2)+' · multiple = '+r2(v.v1/v.v0,4)+'x'}},
  a:[L3('No time dimension; two investments with the same ROI over different periods are not comparable.','بُعد زمان ندارد؛ دو سرمایه‌گذاری با ROI یکسان در دوره‌های مختلف قابل‌مقایسه نیستند.','ڕەهەندی کات نییە؛ دوو وەبەرهێنان بە هەمان ROI لە ماوەی جیاوازدا بەراوردکراو نین.')],
  l:[L3('Use the annualised figure to compare across different holding periods.','برای مقایسهٔ دوره‌های نگهداری متفاوت از رقم سالانه‌شده استفاده کنید.','بۆ بەراوردکردنی ماوەی جیاوازی هەڵگرتن ژمارەی ساڵانەکراو بەکاربهێنە.')]},

 'annualised':{n:L3('Annualised return','بازدهی سالانه‌شده','قازانجی ساڵانەکراو'),term:'expected-value',
  tex:'CAGR=\\left(1+\\frac{ROI}{100}\\right)^{\\frac{365}{d}}-1',
  f:[['roiPct',L3('Total return (%)','بازدهی کل (٪)','قازانجی گشتی (٪)'),45],
     ['days',L3('Holding period (days)','دورهٔ نگهداری (روز)','ماوەی هەڵگرتن (ڕۆژ)'),180]],
  c:v=>{if(!(v.days>0))return{v:NaN,u:'',x:'days must be positive'};
    const g=1+v.roiPct/100;
    if(g<=0)return{v:NaN,u:'',x:'a total loss cannot be annualised'};
    const c=(Math.pow(g,365/v.days)-1)*100;
    return{v:r2(c,3),u:'%',x:'compounding factor = '+r2(365/v.days,4)+' periods per year'}},
  a:[L3('Assumes the same rate compounds for a full year, which a short sample rarely justifies.','فرض می‌کند همان نرخ یک سال کامل مرکب می‌شود؛ نمونهٔ کوتاه به‌ندرت این را توجیه می‌کند.','گریمانە دەکات هەمان ڕێژە ساڵێکی تەواو لێک دەدرێت، کە نموونەیەکی کورت بە دەگمەن پاساوی بۆ دەهێنێت.')],
  l:[L3('Annualising a few good weeks produces a number that means nothing.','سالانه کردن چند هفتهٔ خوب عددی می‌سازد که معنایی ندارد.','ساڵانەکردنی چەند هەفتەی باش ژمارەیەک دروست دەکات کە هیچ مانایەکی نییە.')]},

 'volatility':{n:L3('Volatility','نوسان','لەرزۆکی نرخ'),term:'volatility',
  tex:'\\sigma=\\sqrt{\\frac{\\sum (r_i-\\bar r)^2}{n-1}},\\qquad \\sigma_{ann}=\\sigma\\sqrt{T}',
  f:[['returns',L3('Period returns % (comma separated)','بازدهی دوره‌ها ٪ (با کاما)','قازانجی خولەکان ٪ (بە کۆما)'),'1.2, -0.8, 2.1, -1.5, 0.6, 1.9, -2.3'],
     ['periods',L3('Periods per year (crypto 365, equities 252)','دوره در سال (کریپتو ۳۶۵، سهام ۲۵۲)','خول لە ساڵێک (کریپتۆ ٣٦٥، پشک ٢٥٢)'),365]],
  c:v=>{const r=nums(v.returns);
    if(r.length<2)return{v:NaN,u:'',x:'at least two returns are needed'};
    const s=sd(r);
    return{v:r2(s,4),u:'% '+'per period',x:'annualised = '+r2(s*Math.sqrt(v.periods),3)+'% · mean = '+r2(mean(r),4)+'% · n = '+r.length}},
  a:[L3('The sqrt(T) scaling assumes returns are independent across periods.','مقیاس‌دهی با جذر T فرض می‌کند بازدهی‌ها در دوره‌ها مستقل‌اند.','پێوانەکردن بە ڕەگی T گریمانە دەکات قازانجەکان لە خولەکاندا سەربەخۆن.'),
     L3('Sample standard deviation with the n-1 denominator is used.','انحراف معیار نمونه‌ای با مخرج n−۱ استفاده شده.','لادانی ستانداردی نموونە بە بنژێری n−١ بەکارهێنراوە.')],
  l:[L3('Volatility is not risk of loss; it is dispersion, and it is symmetric.','نوسان، ریسک ضرر نیست؛ پراکندگی است و متقارن است.','لەرزۆکی مەترسی زیان نییە؛ بڵاوبوونەوەیە و هاوسەنگە.')]},

 'drawdown':{n:L3('Maximum drawdown','بیشترین افت سرمایه','زۆرترین داشکانی سەرمایە'),term:'drawdown',
  tex:'MDD=\\max_t\\frac{\\text{peak}_t-V_t}{\\text{peak}_t}\\times 100',
  f:[['series',L3('Equity curve (comma separated)','منحنی سرمایه (با کاما)','هێڵی سەرمایە (بە کۆما)'),'1000, 1200, 1100, 900, 1050, 800, 950']],
  c:v=>{const s=nums(v.series);
    if(s.length<2)return{v:NaN,u:'',x:'at least two points are needed'};
    let peak=s[0],mdd=0,tr=s[0],pk=s[0];
    for(const x of s){if(x>peak)peak=x;const d=(peak-x)/peak;if(d>mdd){mdd=d;tr=x;pk=peak}}
    const need=tr>0?(pk/tr-1)*100:NaN;
    return{v:r2(mdd*100,3),u:'%',x:'peak '+r2(pk,2)+' → trough '+r2(tr,2)+' · gain needed to recover = '+r2(need,2)+'%'}},
  a:[L3('Computed on the series given, so it depends entirely on the sampling frequency.','روی همان سری دادهٔ ورودی محاسبه می‌شود، پس کاملاً به فراوانی نمونه‌برداری وابسته است.','لەسەر هەمان زنجیرەی داتا ژمێردراوە، بۆیە بە تەواوی بە چەندێتی نموونەگرتن بەندە.')],
  l:[L3('Intraday drawdown is deeper than a daily-close series shows.','افت درون‌روزی عمیق‌تر از آن است که سری بسته‌شدن روزانه نشان می‌دهد.','داشکانی ناوڕۆژ قووڵترە لەوەی زنجیرەی داخستنی ڕۆژانە نیشان دەدات.')]},

 'sharpe':{n:L3('Sharpe ratio','نسبت شارپ','ڕێژەی شارپ'),term:'sharpe-ratio',
  tex:'S=\\frac{\\bar r-r_f}{\\sigma_{excess}}\\sqrt{T}',
  f:[['returns',L3('Period returns % (comma separated)','بازدهی دوره‌ها ٪ (با کاما)','قازانجی خولەکان ٪ (بە کۆما)'),'1.2, -0.8, 2.1, -1.5, 0.6, 1.9, -2.3, 1.1'],
     ['rfAnnualPct',L3('Risk-free rate, annual (%)','نرخ بدون ریسک، سالانه (٪)','ڕێژەی بێ‌مەترسی، ساڵانە (٪)'),4],
     ['periods',L3('Periods per year','دوره در سال','خول لە ساڵێک'),365]],
  c:v=>{const r=nums(v.returns);
    if(r.length<2)return{v:NaN,u:'',x:'at least two returns are needed'};
    const rf=v.rfAnnualPct/v.periods;
    const ex=r.map(x=>x-rf);const s=sd(ex);
    if(!(s>0))return{v:NaN,u:'',x:'excess returns have no dispersion'};
    const S0=mean(ex)/s*Math.sqrt(v.periods);
    return{v:r2(S0,4),u:L3('annualised','سالانه‌شده','ساڵانەکراو'),
      x:'mean excess = '+r2(mean(ex),4)+'% per period · sd = '+r2(s,4)+'% · n = '+r.length}},
  a:[L3('Risk-free rate is divided by the period count, not de-compounded.','نرخ بدون ریسک بر تعداد دوره تقسیم شده، نه با فرمول مرکب تبدیل.','ڕێژەی بێ‌مەترسی بەسەر ژمارەی خول دابەش کراوە، نەک بە فۆرموڵی لێکدراو.'),
     L3('A short sample makes the estimate very unstable.','نمونهٔ کوتاه برآورد را بسیار ناپایدار می‌کند.','نموونەی کورت خەمڵاندن زۆر ناجێگیر دەکات.')],
  l:[L3('Penalises upside volatility as heavily as downside; illiquid or smoothed returns inflate it.','نوسان مثبت را به‌اندازهٔ منفی جریمه می‌کند؛ بازدهی کم‌نقد یا هموارشده آن را متورم می‌کند.','لەرزۆکی ئەرێنی وەک نەرێنی سزا دەدات؛ قازانجی کەم‌ئاڵوگۆڕ یان هێواشکراو بەرزی دەکاتەوە.')]}
};
if(typeof window!=='undefined')window.CALC=CALC;
if(typeof module!=='undefined'&&module.exports)module.exports={CALC,sd,mean,nums,r2};

/* ---------------- view: calculators ---------------- */
function vCalc(V,arg){
  const L=t(),keys=Object.keys(CALC);
  const key=CALC[arg]?arg:(lsGet('calc',keys[0])in CALC?lsGet('calc',keys[0]):keys[0]);
  lsSet('calc',key);
  V.innerHTML='<h1>'+esc(L.calcTitle)+'</h1><p class="lede">'+esc(L.calcLede)+'</p>'
   +'<div class="calcgrid" style="margin-top:18px">'
   +'<div class="calclist">'+keys.map(k=>'<button data-k="'+k+'" aria-pressed="'+(k===key)+'">'+esc(CALC[k].n[S.lang])+'</button>').join('')+'</div>'
   +'<div id="cpane"></div></div>';
  V.querySelectorAll('[data-k]').forEach(b=>b.addEventListener('click',()=>{location.hash=href('calc',b.dataset.k)}));
  const C=CALC[key],term=S.idx.find(x=>x.i===C.term);
  $('#cpane').innerHTML='<div class="card">'
   +'<h2 style="font-size:20px">'+esc(C.n[S.lang])+'</h2>'
   +'<div class="mathline" data-tex="'+esc(C.tex)+'" data-display></div>'
   +'<span class="xs mono muted" style="text-transform:uppercase;letter-spacing:.09em">'+esc(L.inputs)+'</span>'
   +'<div class="fields">'+C.f.map(([k,lb,dv])=>
     '<div><label for="f_'+k+'">'+esc(lb[S.lang])+'</label>'
     +'<input id="f_'+k+'" type="'+(typeof dv==='string'?'text':'number')+'" step="any" value="'+esc(dv)+'"></div>').join('')
   +'</div>'
   +'<div class="out"><span class="k">'+esc(L.output)+'</span><span class="v" id="cv">—</span><span class="ex2" id="cx"></span></div>'
   +'<div style="margin-top:14px"><span class="xs mono muted" style="text-transform:uppercase;letter-spacing:.09em">'+esc(L.assumptions)+'</span>'
   +'<ul class="small" style="margin:6px 0 0;padding-inline-start:18px">'+C.a.map(a=>'<li>'+esc(a[S.lang])+'</li>').join('')+'</ul></div>'
   +'<div class="warnbox"><b class="xs mono">'+esc(L.mlimits)+'</b><ul style="margin:6px 0 0;padding-inline-start:18px">'+C.l.map(a=>'<li>'+esc(a[S.lang])+'</li>').join('')+'</ul></div>'
   +(term?'<p style="margin:14px 0 0"><a class="btn xs" href="'+href('term',C.term)+'">'+esc(term.t[S.lang])+' →</a></p>':'')
   +'</div>';
  const run=()=>{
    const v={};C.f.forEach(([k,,dv])=>{
      const el=$('#f_'+k);v[k]=typeof dv==='string'?el.value:N(el.value);
    });
    let out;try{out=C.c(v)}catch(e){out={v:NaN,u:'',x:String(e.message||e)}}
    const val=out.v;
    $('#cv').textContent=(val==null||!isFinite(val))?'—':String(val)+(out.u?' ':'')+(out.u?(typeof out.u==='string'?out.u:out.u[S.lang]):'');
    $('#cx').textContent=out.x||'';
  };
  C.f.forEach(([k])=>$('#f_'+k).addEventListener('input',run));
  run();renderMathIn($('#cpane'));
  S.route.title=C.n[S.lang];
}

/* ---------------- view: academy ---------------- */
function vAcademy(V,arg){
  const L=t();
  const tab=arg||'paths';
  const prog=lsGet('prog',{seen:{},quiz:{right:0,total:0}});
  const byLvl=n=>S.idx.filter(e=>e.l===n);
  V.innerHTML='<h1>'+esc(L.academyTitle)+'</h1><p class="lede">'+esc(L.academyLede)+'</p>'
   +'<div class="depth" style="margin-top:16px">'+[['paths',L.paths],['flash',L.flashcards],['quiz',L.quiz]].map(([k,lb])=>
     '<button data-tab="'+k+'" aria-selected="'+(k===tab)+'">'+esc(lb)+'</button>').join('')+'</div>'
   +'<div id="apane"></div>';
  V.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{location.hash=href('academy',b.dataset.tab)}));
  const P=$('#apane');
  if(tab==='paths'){
    const seen=Object.keys(prog.seen||{}).length;
    P.innerHTML='<div class="grid g3">'+[1,2,3].map(n=>{
      const list=byLvl(n),done=list.filter(e=>prog.seen&&prog.seen[e.i]).length;
      const pct=list.length?Math.round(done/list.length*100):0;
      return '<div class="path"><span class="xs mono" style="color:var(--gold)">'+esc(L.level)+' '+n+'</span>'
       +'<h3>'+esc(lvlLabel(n))+'</h3>'
       +'<p class="small muted" style="margin:0">'+list.length+' '+esc(L.terms)+'</p>'
       +'<div class="bar"><i style="width:'+pct+'%"></i></div>'
       +'<p class="xs mono muted" style="margin:0">'+done+' / '+list.length+' · '+pct+'%</p>'
       +'<a class="btn" href="'+href('academy','flash')+'">'+esc(L.startPath)+'</a></div>'}).join('')+'</div>'
     +'<div class="sect"><h2>'+esc(L.progress)+'</h2>'
     +'<div class="grid g3"><div class="stat"><span class="v">'+seen+'</span><span class="k">'+esc(L.cardsDone)+'</span></div>'
     +'<div class="stat"><span class="v">'+(prog.quiz?prog.quiz.right:0)+'/'+(prog.quiz?prog.quiz.total:0)+'</span><span class="k">'+esc(L.score)+'</span></div>'
     +'<div class="stat"><span class="v">'+S.idx.length+'</span><span class="k">'+esc(L.terms)+'</span></div></div>'
     +'<p style="margin-top:12px"><button class="btn xs" id="rst">'+esc(L.clear)+'</button></p></div>';
    const r=$('#rst');if(r)r.addEventListener('click',()=>{lsSet('prog',{seen:{},quiz:{right:0,total:0}});vAcademy(V,arg)});
  }
  if(tab==='flash'){
    const pool=S.idx.slice();
    let i=Math.floor(Math.random()*pool.length),flipped=false;
    const draw=()=>{
      const e=pool[i];
      P.innerHTML='<div class="flash" id="fc">'+(flipped
        ?'<div><div class="xs mono muted">'+esc(e.t.en)+'</div><p class="a" style="margin-top:9px">'+esc(e.d[S.lang])+'</p>'
          +'<a class="btn xs" href="'+href('term',e.i)+'" style="margin-top:10px">'+esc(L.nav.dict)+' →</a></div>'
        :'<div><div class="q">'+esc(e.t[S.lang])+'</div><p class="xs muted" style="margin-top:12px">'+esc(L.flip)+'</p></div>')+'</div>'
       +'<div class="row" style="margin-top:12px;justify-content:space-between">'
       +'<button class="btn" id="pv">'+esc(L.prev)+'</button>'
       +'<span class="row"><button class="btn" id="kn">'+esc(L.know)+'</button><button class="btn" id="dk">'+esc(L.dontKnow)+'</button></span>'
       +'<button class="btn pri" id="nx">'+esc(L.next)+'</button></div>'
       +'<p class="xs mono muted" style="margin-top:9px">'+(i+1)+' / '+pool.length+'</p>';
      $('#fc').addEventListener('click',()=>{flipped=!flipped;draw()});
      $('#nx').addEventListener('click',()=>{i=(i+1)%pool.length;flipped=false;draw()});
      $('#pv').addEventListener('click',()=>{i=(i-1+pool.length)%pool.length;flipped=false;draw()});
      $('#kn').addEventListener('click',()=>{mark(pool[i].i,true);i=(i+1)%pool.length;flipped=false;draw()});
      $('#dk').addEventListener('click',()=>{mark(pool[i].i,false);flipped=true;draw()});
    };
    const mark=(id,known)=>{const p=lsGet('prog',{seen:{},quiz:{right:0,total:0}});p.seen=p.seen||{};p.seen[id]=known?1:0;lsSet('prog',p)};
    draw();
  }
  if(tab==='quiz'){
    let timer=null;
    const draw=()=>{
      if(!document.body.contains(P)){clearTimeout(timer);return} // view was replaced; stop redrawing
      const pool=S.idx.slice();
      const correct=pool[Math.floor(Math.random()*pool.length)];
      const wrong=[];
      while(wrong.length<3){
        const c=pool[Math.floor(Math.random()*pool.length)];
        if(c.i!==correct.i&&!wrong.find(w=>w.i===c.i))wrong.push(c);
      }
      const opts=[correct,...wrong].sort(()=>Math.random()-0.5);
      const p=lsGet('prog',{seen:{},quiz:{right:0,total:0}});
      P.innerHTML='<div class="qz"><p class="xs mono muted">'+esc(L.quizQ)+'</p>'
       +'<h2 style="margin:6px 0 14px">'+esc(correct.t[S.lang])+'</h2>'
       +opts.map(o=>'<button class="opt" data-i="'+esc(o.i)+'">'+esc(o.d[S.lang])+'</button>').join('')
       +'<div class="row" style="margin-top:12px"><span class="chip mono">'+esc(L.score)+': '+(p.quiz?p.quiz.right:0)+'/'+(p.quiz?p.quiz.total:0)+'</span>'
       +'<button class="btn xs" id="nq">'+esc(L.newQuiz)+'</button></div></div>';
      $('#nq').addEventListener('click',draw);
      P.querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>{
        const ok=b.dataset.i===correct.i;
        P.querySelectorAll('.opt').forEach(x=>{x.disabled=true;if(x.dataset.i===correct.i)x.classList.add('ok')});
        if(!ok)b.classList.add('no');
        const q=lsGet('prog',{seen:{},quiz:{right:0,total:0}});
        q.quiz=q.quiz||{right:0,total:0};q.quiz.total++;if(ok)q.quiz.right++;lsSet('prog',q);
        timer=setTimeout(draw,1400);
      }));
    };
    draw();
  }
  S.route.title=L.academyTitle;
}

/* ---------------- view: concept map ---------------- */
function vMap(V,arg){
  const L=t();
  const focus=S.idx.find(e=>e.i===arg);
  const catSel=lsGet('mapcat','');
  V.innerHTML='<h1>'+esc(L.mapTitle)+'</h1><p class="lede">'+esc(L.mapLede)+'</p>'
   +'<div class="row" style="margin:14px 0"><select id="mc" style="max-width:300px"><option value="">'+esc(L.mapAll)+'</option>'
   +S.meta.categories.map(c=>'<option value="'+c.id+'"'+(c.id===catSel?' selected':'')+'>'+c.id+' '+esc(c.name[S.lang])+'</option>').join('')+'</select>'
   +(focus?'<span class="chip gold">'+esc(L.neighbourhood)+': '+esc(focus.t[S.lang])+'</span><a class="btn xs" href="'+href('map')+'">'+esc(L.clear)+'</a>':'')
   +'</div><div class="mapwrap" id="mw"></div>';
  $('#mc').addEventListener('change',()=>{lsSet('mapcat',$('#mc').value);vMap(V,arg)});
  const nodes=focus?neighbourhood(focus):(catSel?S.idx.filter(e=>e.c===catSel):S.idx);
  drawMap($('#mw'),nodes,focus);
  S.route.title=L.mapTitle;
}
function neighbourhood(f){
  const ids=new Set([f.i,...(f.r||[]),...(f.w||[])]);
  S.idx.forEach(e=>{if((e.r||[]).includes(f.i)||(e.w||[]).includes(f.i))ids.add(e.i)});
  return S.idx.filter(e=>ids.has(e.i));
}
function drawMap(host,nodes,focus){
  const L=t();
  if(!nodes.length){host.innerHTML='<p class="small muted" style="padding:16px">'+esc(L.noResults)+'</p>';return}
  const W=900,H=Math.max(420,Math.min(900,120+nodes.length*11));
  const cx=W/2,cy=H/2,R=Math.min(W,H)/2-74;
  const byCat={};nodes.forEach(e=>{(byCat[e.c]=byCat[e.c]||[]).push(e)});
  const cats=Object.keys(byCat).sort();
  const pos={};
  if(focus){
    pos[focus.i]={x:cx,y:cy,r:11};
    const rest=nodes.filter(e=>e.i!==focus.i);
    rest.forEach((e,i)=>{const a=(i/rest.length)*Math.PI*2-Math.PI/2;
      pos[e.i]={x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R,r:7}});
  }else{
    let k=0;const total=nodes.length;
    cats.forEach((c,ci)=>{
      const span=byCat[c].length/total*Math.PI*2;
      const start=(k/total)*Math.PI*2-Math.PI/2;
      byCat[c].forEach((e,i)=>{
        const a=start+(byCat[c].length>1?(i/(byCat[c].length))*span:span/2);
        const rr=R*(0.74+0.26*((i%3)/2));
        pos[e.i]={x:cx+Math.cos(a)*rr,y:cy+Math.sin(a)*rr,r:6};
      });
      k+=byCat[c].length;
    });
  }
  const ids=new Set(nodes.map(e=>e.i));
  let links='';
  nodes.forEach(e=>{
    (e.r||[]).forEach(o=>{if(ids.has(o)&&e.i<o)links+=
      '<line x1="'+pos[e.i].x.toFixed(1)+'" y1="'+pos[e.i].y.toFixed(1)+'" x2="'+pos[o].x.toFixed(1)+'" y2="'+pos[o].y.toFixed(1)+'" stroke="currentColor" stroke-width="0.6" opacity="0.2"/>'});
    (e.w||[]).forEach(o=>{if(ids.has(o))links+=
      '<line x1="'+pos[e.i].x.toFixed(1)+'" y1="'+pos[e.i].y.toFixed(1)+'" x2="'+pos[o].x.toFixed(1)+'" y2="'+pos[o].y.toFixed(1)+'" stroke="#c2410c" stroke-width="1" stroke-dasharray="3 3" opacity="0.5"/>'});
  });
  const labels=nodes.map(e=>{
    const p=pos[e.i],right=p.x>=cx;
    const show=focus||nodes.length<=46;
    return '<g class="nd" data-id="'+esc(e.i)+'" tabindex="0">'
      +'<circle cx="'+p.x.toFixed(1)+'" cy="'+p.y.toFixed(1)+'" r="'+p.r+'" fill="'+catColor(e.c)+'" fill-opacity="0.85" stroke="var(--surface)" stroke-width="1.5"/>'
      +(show?'<text x="'+(p.x+(right?p.r+5:-p.r-5)).toFixed(1)+'" y="'+(p.y+3.5).toFixed(1)+'" text-anchor="'+(right?'start':'end')
        +'" font-size="10.5" fill="currentColor" style="font-family:var(--sans)">'+esc(e.t[S.lang].slice(0,26))+'</text>':'')
      +'<title>'+esc(e.t[S.lang]+' — '+e.t.en)+'</title></g>';
  }).join('');
  host.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(L.mapTitle)+'" style="color:var(--ink)">'
    +links+labels+'</svg>'
    +'<div class="lg">'+cats.map(c=>'<span><i style="background:'+catColor(c)+'"></i>'+esc(catById(c)?catById(c).name[S.lang]:c)+'</span>').join('')
    +'<span><i style="background:#c2410c"></i>'+esc(L.confused)+'</span></div>';
  host.querySelectorAll('.nd').forEach(g=>{
    const go=()=>{location.hash=href('map',g.dataset.id)};
    g.addEventListener('click',go);
    g.addEventListener('keydown',e=>{if(e.key==='Enter')go()});
  });
}

/* ---------------- view: editorial dashboard ---------------- */
function vEditorial(V){
  const L=t();
  const cnt=(f)=>{const o={};S.idx.forEach(e=>{const k=f(e);o[k]=(o[k]||0)+1});return o};
  const byState=cnt(e=>e.e),byClaim=cnt(e=>e.q),byCkb=cnt(e=>e.s.ckb);
  const srcs=Object.entries(S.meta.sources);
  const ver=srcs.filter(([,s])=>s.url_verified).length;
  const bar=(obj,toneFor)=>{
    const total=Object.values(obj).reduce((a,b)=>a+b,0);
    return '<div class="scrollx"><table class="t"><tbody>'+Object.entries(obj).sort((a,b)=>b[1]-a[1]).map(([k,v])=>
      '<tr><td><span class="chip '+(toneFor?toneFor(k):'')+'">'+esc(toneFor===statusToneCls?statusLabel(k):(byState===obj?stateLabel(k):k))+'</span></td>'
      +'<td class="num">'+v+'</td>'
      +'<td style="width:55%"><div class="bar"><i style="width:'+Math.round(v/total*100)+'%"></i></div></td>'
      +'<td class="num xs muted">'+Math.round(v/total*100)+'%</td></tr>').join('')+'</tbody></table></div>';
  };
  function statusToneCls(k){return toneCls(statusTone(k))}
  V.innerHTML='<h1>'+esc(L.edTitle)+'</h1><p class="lede">'+esc(L.edLede)+'</p>'
   +'<div class="notice" style="margin:16px 0">'+esc(L.gates)+': '+esc(S.meta.editorial_states.find(s=>s.id==='published').desc[S.lang])+'</div>'
   +'<div class="grid g4" style="margin:16px 0">'
   +'<div class="stat"><span class="v">'+S.idx.length+'</span><span class="k">'+esc(L.terms)+'</span></div>'
   +'<div class="stat"><span class="v">0</span><span class="k">published</span></div>'
   +'<div class="stat"><span class="v">'+(byState['needs-expert']||0)+'</span><span class="k">'+esc(stateLabel('needs-expert'))+'</span></div>'
   +'<div class="stat"><span class="v">'+ver+'/'+srcs.length+'</span><span class="k">'+esc(L.verified)+'</span></div>'
   +'</div>'
   +'<div class="sect"><h2>'+esc(L.byState)+'</h2>'+bar(byState)+'</div>'
   +'<div class="sect"><h2>'+esc(L.byClaim)+'</h2>'+bar(byClaim)+'</div>'
   +'<div class="sect"><h2>'+esc(L.byCkb)+'</h2>'+bar(byCkb,statusToneCls)+'</div>'
   +'<div class="sect"><h2>'+esc(L.gates)+'</h2>'
   +'<div class="scrollx"><table class="t"><thead><tr><th>'+esc(L.terms)+'</th><th>'+esc(L.fStatus)+'</th><th>'+esc(L.byClaim)+'</th><th>ckb</th><th>'+esc(L.gates)+'</th></tr></thead><tbody>'
   +S.idx.slice().sort((a,b)=>a.e.localeCompare(b.e)||a.t.en.localeCompare(b.t.en)).map(e=>
     '<tr><td><a href="'+href('term',e.i)+'">'+esc(e.t[S.lang])+'</a><br><span class="xs muted mono">'+esc(e.i)+'</span></td>'
     +'<td><span class="chip '+(e.e==='draft'?'':'warn')+'">'+esc(stateLabel(e.e))+'</span></td>'
     +'<td class="xs mono">'+esc(e.q)+'</td>'
     +'<td><span class="chip '+statusToneCls(e.s.ckb)+'">'+esc(statusLabel(e.s.ckb))+'</span></td>'
     +'<td><span class="pill">4 × model-drafted</span></td></tr>').join('')
   +'</tbody></table></div></div>'
   +'<div class="sect"><h2>'+esc(L.registry)+'</h2>'
   +'<p class="small muted">'+esc(S.meta.source_rule)+'</p>'
   +'<div class="scrollx"><table class="t"><thead><tr><th>id</th><th>title</th><th>org</th><th>url</th></tr></thead><tbody>'
   +srcs.map(([k,s])=>'<tr><td class="xs mono">'+esc(k)+'</td><td>'+esc(s.title)+(s.author?'<br><span class="xs muted">'+esc(s.author)+'</span>':'')+'</td>'
     +'<td class="xs">'+esc(s.org||'')+'</td>'
     +'<td>'+(s.url?'<a class="xs" href="'+esc(s.url)+'" target="_blank" rel="noopener noreferrer">link</a> <span class="chip good xs">✓</span>':'<span class="chip xs">'+esc(L.unverified)+'</span>')+'</td></tr>').join('')
   +'</tbody></table></div></div>'
   +'<p style="margin-top:18px"><a class="btn pri" href="'+href('submit')+'">'+esc(L.submitTitle)+'</a></p>';
  S.route.title=L.edTitle;
}

/* ---------------- view: submit ---------------- */
function vSubmit(V){
  const L=t();
  V.innerHTML='<h1>'+esc(L.submitTitle)+'</h1><p class="lede">'+esc(L.submitLede)+'</p>'
   +'<div class="card" style="margin-top:16px;max-width:680px">'
   +'<div class="fields">'
   +'<div><label for="s_en">'+esc(L.fTerm)+'</label><input id="s_en" type="text"></div>'
   +'<div><label for="s_fa">'+esc(L.fFa)+'</label><input id="s_fa" type="text"></div>'
   +'<div><label for="s_ckb">'+esc(L.fCkb)+'</label><input id="s_ckb" type="text"></div>'
   +'</div>'
   +'<div><label for="s_note">'+esc(L.fNote)+'</label><textarea id="s_note" rows="5"></textarea></div>'
   +'<div class="row" style="margin-top:13px"><button class="btn pri" id="gi">'+esc(L.makeIssue)+'</button>'
   +'<button class="btn" id="cp">'+esc(L.copyText)+'</button><span class="xs muted" id="msg"></span></div>'
   +'<pre class="mono xs" id="prev" style="margin-top:14px;white-space:pre-wrap;background:var(--surface-2);padding:11px;border-radius:6px;border:1px solid var(--line)"></pre>'
   +'</div>';
  const body=()=>{
    const en=$('#s_en').value.trim(),fa=$('#s_fa').value.trim(),ck=$('#s_ckb').value.trim(),nt=$('#s_note').value.trim();
    return 'Term (en): '+en+'\nEquivalent (fa): '+fa+'\nEquivalent (ckb): '+ck
      +'\n\nNote / source:\n'+nt
      +'\n\n---\nSubmitted from the encyclopedia submission form. Terminology status must be set by a reviewer, not by the submitter.';
  };
  const upd=()=>{$('#prev').textContent=body()};
  ['s_en','s_fa','s_ckb','s_note'].forEach(id=>$('#'+id).addEventListener('input',upd));
  upd();
  $('#gi').addEventListener('click',()=>{
    const title='[terminology] '+($('#s_en').value.trim()||'proposal');
    window.open(REPO+'/issues/new?title='+encodeURIComponent(title)+'&body='+encodeURIComponent(body()),'_blank','noopener');
  });
  $('#cp').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(body());$('#msg').textContent=L.copied}
    catch(e){const r=document.createRange();r.selectNode($('#prev'));
      const s=window.getSelection();s.removeAllRanges();s.addRange(r);$('#msg').textContent='—'}
  });
  S.route.title=L.submitTitle;
}

/* ---------------- view: about ---------------- */
function vAbout(V){
  const L=t();
  const txt={
   fa:[['روش کار','هر مدخل در سه زبان و در چهار عمق نوشته می‌شود: ساده، حرفه‌ای، فنی و دانشگاهی. فارسی و کوردی ترجمهٔ انگلیسی نیستند؛ هر زبان متن خودش را دارد و معنا باید یکی باشد.'],
      ['فرهنگ واژگان مشترک','۸۶ مفهوم پرتکرار در یک فرهنگ واژگان مشترک قفل شده‌اند تا ۱۰۹ مدخل یک اثر واحد باشند، نه ۱۰۹ ترجمهٔ جداگانه.'],
      ['منابع بسته','هر مدخل فقط می‌تواند از فهرست بستهٔ منابع نقل کند. هیچ نشانی ساختگی در این دانشنامه نیست؛ نشانی‌هایی که با «تأییدشده» علامت دارند واقعاً بازدید شده‌اند.'],
      ['صداقت دربارهٔ معادل کوردی','اصطلاح‌شناسی مالی کوردی سۆرانی در بسیاری از مفاهیم تثبیت‌شده نیست. هر معادلی که ساختهٔ همین پروژه است «پیشنهادی» علامت خورده و اصطلاح انگلیسی کنارش حفظ شده.'],
      ['آنچه هنوز انجام نشده','هیچ مدخلی بازبینی انسانی نشده. ارزیابی زبانی بومی، بازبینی مالی و تأیید منابع باید انجام شود. تا آن زمان هیچ مدخلی «منتشرشده» علامت نمی‌خورد.'],
      ['روش موکری','سه مدخل روش اختصاصی نگارنده را مستند می‌کنند و صریحاً «چارچوب اختصاصی نگارنده» علامت خورده‌اند — نه اجماع علمی و نه اعتبارسنجی‌شده.']],
   ckb:[['ڕێبازی کار','هەر مدخلێک بە سێ زمان و لە چوار قووڵاییدا دەنووسرێت: ساکار، پیشەیی، تەکنیکی و ئەکادیمی. فارسی و کوردی وەرگێرانی ئینگلیزی نین؛ هەر زمانێک دەقی خۆی هەیە و مانا دەبێت یەک بێت.'],
      ['وشەنامەی هاوبەش','٨٦ چەمکی زۆر دووبارە لە وشەنامەیەکی هاوبەشدا قوفڵ کراون تا ١٠٩ مدخل یەک بەرهەم بن، نەک ١٠٩ وەرگێرانی جیاواز.'],
      ['سەرچاوەی داخراو','هەر مدخلێک تەنها دەتوانێت لە لیستی داخراوی سەرچاوەکان بهێنێتەوە. هیچ ناونیشانێکی دەستکرد لەم ئەنسایکلۆپیدیادا نییە.'],
      ['ڕاستگۆیی دەربارەی هاوتای کوردی','زاراوەسازی داراییی کوردی سۆرانی لە زۆرێک لە چەمکەکاندا جێگیر نییە. هەر هاوتایەک کە دروستکراوی ئەم پڕۆژەیە «پێشنیارکراو» نیشانە کراوە و زاراوەی ئینگلیزی لەگەڵیدا پارێزراوە.'],
      ['ئەوەی هێشتا نەکراوە','هیچ مدخلێک پێداچوونەوەی مرۆیی نەکراوە. هەڵسەنگاندنی زمانی زگماکی، پێداچوونەوەی دارایی و پشتڕاستکردنی سەرچاوەکان دەبێت بکرێن.'],
      ['ڕێبازی موکری','سێ مدخل ڕێبازی تایبەتی نووسەر تۆمار دەکەن و بە ئاشکرا «چوارچێوەی تایبەتی نووسەر» نیشانە کراون — نەک کۆدەنگی زانستی و نەک پشتڕاستکراو.']],
   en:[['Method','Every entry is written in three languages at four depths: simple, professional, technical and academic. Persian and Kurdish are not translations of the English; each language has its own text and the meaning must match.'],
      ['Shared lexicon','86 recurring concepts are locked in a shared lexicon, so 109 entries read as one work rather than 109 separate translations.'],
      ['Closed source registry','An entry may cite only sources in a closed registry. There are no fabricated references here; a URL marked verified was actually retrieved.'],
      ['Honesty about Kurdish','Kurdish Sorani financial terminology is unsettled for many concepts. Any equivalent coined by this project is marked proposed, with the English term kept beside it.'],
      ['What has not been done','No entry has had human review. Native linguistic assessment, subject-matter review and source confirmation all remain to be done. Until then nothing is marked published.'],
      ['The Mokri method','Three entries document the author’s own framework and are explicitly marked as such — not scientific consensus and not independently validated.']]
  }[S.lang];
  V.innerHTML='<h1>'+esc(L.aboutTitle)+'</h1>'
   +'<div class="measure" style="margin-top:14px">'+txt.map(([h,p])=>'<h2 style="font-size:18px;margin-top:22px">'+esc(h)+'</h2><p>'+esc(p)+'</p>').join('')+'</div>'
   +'<div class="sect"><h2>'+esc(L.registry)+'</h2><p class="small muted">'+Object.keys(S.meta.sources).length+' sources · '
   +Object.values(S.meta.sources).filter(s=>s.url_verified).length+' '+esc(L.verified)+'</p>'
   +'<p><a class="btn" href="'+href('editorial')+'">'+esc(L.edTitle)+' →</a></p></div>';
  S.route.title=L.aboutTitle;
}

/* ---------------- go ---------------- */
if(typeof document!=='undefined'&&document.getElementById('view'))boot();
