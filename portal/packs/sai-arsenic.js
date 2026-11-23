/* ══════════════════════════════════════════════════════════════════════════
   DATA PACK — one area × one hazard. The site is the same for every pack; to cover another
   river, district or country, copy this file, replace the facts, and register it in packs/index.js.

   Rules for every pack (this is public health information):
   • every fact names its source (`src` → `sources`) and the date the source reports
   • preliminary / screening results say so (`preliminary: true`)
   • nothing here is written as if by a government agency — this site gathers what agencies published
   • when sources disagree, use the official figure and say that other figures exist
   Strings are { th, en }; a missing language falls back to Thai.
   ══════════════════════════════════════════════════════════════════════════ */

export default {
  id: 'th-chiangrai-sai-arsenic',
  updated: '2026-11-23',
  place: { th: 'แม่น้ำสาย อ.แม่สาย จ.เชียงราย', en: 'Sai River, Mae Sai, Chiang Rai' },
  hazard: { th: 'สารหนูปนเปื้อนในแม่น้ำ', en: 'Arsenic in river water' },

  /* the one answer people come for */
  answer: {
    level: 'unsafe',
    th: 'น้ำจากแม่น้ำสายยังไม่ปลอดภัยสำหรับดื่มหรือหุงต้ม',
    en: 'Sai River water is not yet safe to drink or cook with',
    sub: {
      th: 'ใช้น้ำที่ผ่านการตรวจแล้ว เช่น น้ำประปาที่หน่วยงานยืนยัน หรือน้ำดื่มบรรจุขวด การต้มน้ำไม่ช่วยกำจัดสารหนู',
      en: 'Use water that has been tested — tap water the authorities have cleared, or bottled water. Boiling does not remove arsenic.',
    },
    src: ['hfocus-moph', 'komchadluek-pcd'],
  },

  standard: { value: 0.01, unit: 'มก./ล.', unitEn: 'mg/L', label: { th: 'มาตรฐานคุณภาพน้ำผิวดิน', en: 'Thai surface-water standard' }, src: 'komchadluek-pcd' },
  latest: {
    value: 0.25, date: '2026-11-06', preliminary: true,
    where: { th: 'บ้านหัวฝาย อ.แม่สาย', en: 'Ban Hua Fai, Mae Sai' },
    note: {
      th: 'ผลคัดกรองเบื้องต้นของกรมควบคุมมลพิษ รอผลยืนยันจากห้องปฏิบัติการ · สื่อบางแห่งรายงาน 28–30 เท่า',
      en: 'Pollution Control Department screening result, awaiting laboratory confirmation · some outlets report 28–30×',
    },
    src: ['komchadluek-pcd', 'thaipbs-pcd'],
  },

  /* quick status, each with its own source */
  status: [
    { id: 'tap', tone: 'partial',
      th: 'น้ำประปา 14 หมู่บ้านที่หยุดจ่าย กลับมาจ่ายแล้วราว 80%', en: 'Tap water to 14 villages that was cut is back at about 80%',
      date: '2026-11', src: ['nation-cost', 'nation-supply'] },
    { id: 'bottled', tone: 'ok',
      th: 'น้ำดื่มและน้ำแข็งที่ตรวจ 30 ตัวอย่าง ผ่านทั้งหมด', en: 'Drinking water and ice: all 30 samples tested passed',
      date: '2026-11-22', src: ['pptv-weir'] },
    { id: 'health', tone: 'ok',
      th: 'ยังไม่พบผู้ที่ได้รับการวินิจฉัยว่าป่วยจากพิษสารหนู', en: 'No one has been diagnosed with arsenic poisoning so far',
      date: '2026-11', src: ['thaipbs-moph'] },
  ],

  /* what to do today */
  todo: {
    do: [
      { th: 'ดื่มและหุงต้มด้วยน้ำที่ผ่านการตรวจแล้วเท่านั้น', en: 'Drink and cook only with water that has been tested', src: ['hfocus-moph'] },
      { th: 'ติดตามประกาศเรื่องน้ำประปาจากการประปาและอำเภอ ก่อนกลับมาใช้ดื่ม', en: 'Follow the waterworks and district notices before drinking tap water again', src: ['nation-supply', 'thestar-water'] },
      { th: 'ถ้าเจ้าหน้าที่ชวนตรวจปัสสาวะ ให้ไปตรวจ — เป็นการดูว่าได้รับสารหนูมากแค่ไหน ไม่ได้แปลว่าป่วย', en: 'If health staff offer a urine test, take it — it shows exposure, it is not a diagnosis', src: ['thaipbs-moph'] },
      { th: 'ถ้าผิวมีจุดด่างดำ หรือฝ่ามือฝ่าเท้าหนาแข็งผิดปกติ ให้ไปพบแพทย์', en: 'See a doctor if you notice dark skin patches or unusually hard, thick skin on palms or soles', src: ['who-arsenic'] },
    ],
    dont: [
      { th: 'อย่าดื่มหรือหุงต้มด้วยน้ำจากแม่น้ำสายโดยตรง', en: 'Do not drink or cook with water taken straight from the Sai River', src: ['hfocus-moph'] },
      { th: 'อย่าเชื่อว่าต้มน้ำแล้วปลอดภัย — การต้มหรือเติมคลอรีนไม่กำจัดสารหนู', en: 'Do not rely on boiling — boiling or chlorine does not remove arsenic', src: ['hfocus-moph'] },
    ],
  },

  /* what the authorities are doing — in date order; status is what the source reports */
  actions: [
    { date: '2026-05-15', until: '2026-06-28', status: 'unconfirmed', who: { th: 'ทหารช่าง', en: 'Army engineers' },
      th: 'ซ่อมและเสริมพนังกั้นน้ำกึ่งถาวรริมแม่น้ำสาย (กันน้ำท่วม) — รายงานล่าสุดคืบหน้ากว่า 60% ยังไม่พบรายงานว่าเสร็จ',
      en: 'Repair and strengthen the semi-permanent flood embankment along the Sai (flood protection) — last reported over 60% done; no completion report found',
      src: ['nns-embankment'] },
    { date: '2026-11-06', status: 'done', who: { th: 'กรมควบคุมมลพิษ', en: 'Pollution Control Department' },
      th: 'ตรวจคัดกรองน้ำแม่น้ำสายหลังพบน้ำขุ่นแดงผิดปกติ (5 พ.ย.) และเฝ้าระวังคุณภาพน้ำและตะกอนต่อเนื่อง',
      en: 'Screened Sai River water after unusual red, turbid water (5 Nov) and keeps monitoring water and sediment',
      src: ['komchadluek-pcd', 'thaipbs-pcd'] },
    { date: '2026-11', status: 'ongoing', who: { th: 'รัฐบาล · การประปา', en: 'Government · waterworks' },
      th: 'จัดหาน้ำสะอาดให้ครัวเรือนที่ได้รับผลกระทบ และเฝ้าตรวจคุณภาพน้ำประปา',
      en: 'Supplying clean water to affected households and monitoring tap-water quality',
      src: ['aljazeera-water', 'thestar-water'] },
    { date: '2026-11-21', status: 'ongoing', who: { th: 'นายกรัฐมนตรี · รองนายกฯ ยศชนัน', en: 'Prime Minister · Deputy PM Yodchanan' },
      th: 'ตั้งทีมบูรณาการทุกกระทรวง ขับเคลื่อน 6 มาตรการเร่งด่วนแก้สารหนูแม่น้ำกก–สาย',
      en: 'Cross-ministry team set up to drive six urgent measures on arsenic in the Kok and Sai rivers',
      src: ['naewna-pm', 'thairath-6'] },
    { date: '2026-11-22', status: 'announced', who: { th: 'รัฐบาล', en: 'Government' },
      th: 'สร้าง "ฝายดักตะกอนอัจฉริยะ" สกัดตะกอนปนเปื้อน เพื่อปกป้องนาข้าวราว 27,000 ไร่',
      en: 'Build "smart sediment-trap weirs" to hold back contaminated sediment and protect about 27,000 rai of rice fields',
      src: ['thairath-6', 'pptv-weir'] },
    { date: '2026-11-24', until: '2026-11-26', status: 'announced', who: { th: 'ไทย–เมียนมา–จีน', en: 'Thailand–Myanmar–China' },
      th: 'เจรจา 3 ฝ่าย (24 พ.ย.) และคณะทำงานไทย–เมียนมา (25–26 พ.ย.) โดยไทยนำ "ลายพิมพ์สารหนู" ที่ชี้แหล่งที่มาไปหารือ',
      en: 'Three-way talks (24 Nov) and a Thai–Myanmar working group (25–26 Nov); Thailand brings arsenic "fingerprint" evidence of the source',
      src: ['nation-fingerprint'] },
    { date: '2026-12-15', status: 'announced', who: { th: 'กระทรวงเกษตรฯ', en: 'Ministry of Agriculture' },
      th: 'เปิดข้อมูลความปลอดภัยผลผลิตเกษตรและประมงผ่านระบบ Agri-Map',
      en: 'Publish farm and fishery safety data on the Agri-Map system',
      src: ['cmnews-agrimap'] },
    { date: null, status: 'planned', who: { th: 'รัฐบาล', en: 'Government' },
      th: 'เตรียมห้ามส่งออกและขนผ่านสารเคมีที่ใช้ในเหมือง ซึ่งเชื่อว่าเป็นต้นเหตุ — ยังเป็นแผน ยังไม่มีผลบังคับ',
      en: 'Plan to ban export and transit of the mining chemicals believed responsible — a plan, not yet in force',
      src: ['diplomat-ban'] },
    { date: null, status: 'ongoing', who: { th: 'กระทรวงสาธารณสุข', en: 'Ministry of Public Health' },
      th: 'เฝ้าระวังสุขภาพกลุ่มเสี่ยงริมแม่น้ำต่อเนื่องอย่างน้อย 5 ปี และเตรียมสื่อสารความเสี่ยงด้วยเกณฑ์สี 4 ระดับ',
      en: 'Health surveillance of riverside risk groups for at least five years, and a four-colour risk scale for communication',
      src: ['thaipbs-moph', 'posttoday-4level'] },
  ],

  /* the honest gap — what nobody has announced yet */
  unknown: [
    { th: 'ยังไม่มีการประกาศว่าน้ำแม่น้ำสายจะกลับมาใช้ดื่มได้เมื่อไร', en: 'No date has been announced for when Sai River water will be safe to drink again' },
    { th: 'ยังไม่มีผลตรวจทางการเรื่องปลาและพืชผักที่ใช้น้ำแม่น้ำสาย (รอ Agri-Map 15 ธ.ค.)', en: 'No official results yet on fish and crops grown with Sai River water (Agri-Map due 15 Dec)' },
  ],

  /* official monitoring results we could trace to a dated report */
  readings: [
    { date: '2026-11-06', where: { th: 'บ้านหัวฝาย อ.แม่สาย', en: 'Ban Hua Fai, Mae Sai' }, value: 0.25, preliminary: true, src: ['komchadluek-pcd'] },
    { date: '2026-08-07', dateFrom: '2026-08-03', where: { th: 'สะพานมิตรภาพแม่น้ำสายแห่งที่ 2', en: 'Second Sai River Friendship Bridge' }, value: 0.208, round: 22, src: ['lanner-r22'] },
    { date: '2026-08-07', dateFrom: '2026-08-03', where: { th: 'บ้านป่าซางงาม', en: 'Ban Pa Sang Ngam' }, value: 0.184, round: 22, src: ['lanner-r22'] },
  ],
  readingsNote: {
    th: 'ผลตรวจครั้งที่ 22 ยังพบตะกั่วเกินมาตรฐานทั้ง 3 จุดของแม่น้ำสาย · ผลทางการฉบับเต็มดูที่เว็บไซต์กรมควบคุมมลพิษ',
    en: 'Round 22 also found lead above the standard at all three Sai River points · full official results are on the Pollution Control Department website',
    src: ['lanner-r22'],
  },

  impacts: [
    { id: 'health', th: 'สุขภาพ', en: 'Health',
      body: { th: 'อันตรายหลักมาจากการได้รับสะสมเป็นเวลานาน เช่น ผิวหนังเปลี่ยนสี ผื่นหนาแข็ง และเพิ่มความเสี่ยงมะเร็งผิวหนัง จึงต้องเลี่ยงตั้งแต่วันนี้',
              en: 'The main danger is long-term build-up: skin colour changes, hard thick skin, and a higher risk of skin cancer — which is why avoiding it now matters.' },
      src: ['hfocus-moph', 'who-arsenic'] },
    { id: 'water', th: 'น้ำใช้ในบ้าน', en: 'Household water',
      body: { th: 'ประปาบางหมู่บ้านเคยหยุดจ่าย และหลายบ้านต้องซื้อน้ำเพิ่ม เป็นค่าใช้จ่ายที่เพิ่มขึ้นทุกวัน',
              en: 'Tap water in some villages was cut, and many households now buy extra water — a daily added cost.' },
      src: ['nation-cost', 'nation-supply'] },
    { id: 'farm', th: 'นาและการเกษตร', en: 'Rice fields and farms',
      body: { th: 'รัฐตั้งเป้าปกป้องนาข้าวราว 27,000 ไร่ด้วยฝายดักตะกอน และจะเปิดผลความปลอดภัยผลผลิตผ่าน Agri-Map',
              en: 'The government aims to protect about 27,000 rai of rice fields with sediment-trap weirs and will publish produce safety results on Agri-Map.' },
      src: ['thairath-6', 'cmnews-agrimap'] },
    { id: 'source', th: 'ต้นเหตุ', en: 'Where it comes from',
      body: { th: 'การวิเคราะห์ทางเคมีชี้ว่าตะกอนปนเปื้อนในแม่น้ำสายมาจากเหมืองทองฝั่งเมียนมาเป็นหลัก (แม่น้ำกกมาจากเหมืองแร่หายากเป็นหลัก)',
              en: 'Chemical analysis points mainly to gold mining across the border in Myanmar for the Sai (rare-earth mining for the Kok).' },
      src: ['nation-fingerprint'] },
  ],

  faq: [
    { q: { th: 'ต้มน้ำให้เดือดแล้วดื่มได้ไหม', en: 'Can I drink it if I boil it?' },
      a: { th: 'ไม่ได้ การต้มหรือเติมคลอรีนไม่กำจัดสารหนู ต้องใช้น้ำที่ผ่านการตรวจแล้ว', en: 'No. Boiling or chlorine does not remove arsenic; use water that has been tested.' }, src: ['hfocus-moph'] },
    { q: { th: 'ผลตรวจปัสสาวะเกินค่าอ้างอิง แปลว่าป่วยไหม', en: 'Does a urine result above the reference value mean I am ill?' },
      a: { th: 'ไม่ได้แปลว่าป่วย เป็นตัวบอกว่าร่างกายได้รับสารหนูมากแค่ไหน แพทย์ใช้ประกอบการดูแลต่อ', en: 'No. It shows how much arsenic you were exposed to; doctors use it to decide follow-up.' }, src: ['thaipbs-moph'] },
    { q: { th: 'น้ำประปาตอนนี้ดื่มได้ไหม', en: 'Is tap water safe to drink now?' },
      a: { th: 'ขึ้นกับประกาศของการประปาในพื้นที่ของคุณ ประปาบางหมู่บ้านเคยหยุดจ่ายและกำลังกลับมา ให้ฟังประกาศจากการประปาและอำเภอก่อน', en: 'It depends on your local waterworks notice. Supply in some villages was cut and is coming back; follow the waterworks and district.' }, src: ['nation-supply', 'nation-cost'] },
    { q: { th: 'น้ำดื่มบรรจุขวดและน้ำแข็งที่ขายในพื้นที่ปลอดภัยไหม', en: 'Is bottled water and ice sold locally safe?' },
      a: { th: 'ตัวอย่างน้ำดื่มและน้ำแข็งที่หน่วยงานตรวจ 30 ตัวอย่าง ผ่านทั้งหมด', en: 'All 30 samples of drinking water and ice tested by the authorities passed.' }, src: ['pptv-weir'] },
    { q: { th: 'กินปลาหรือผักที่ปลูกด้วยน้ำแม่น้ำสายได้ไหม', en: 'Can I eat fish or vegetables grown with Sai River water?' },
      a: { th: 'ยังไม่มีผลตรวจทางการ รัฐจะเปิดข้อมูลผ่าน Agri-Map ภายใน 15 ธ.ค. 2569 ระหว่างนี้สอบถามเกษตรอำเภอหรือประมงอำเภอ', en: 'No official results yet; Agri-Map data is due by 15 Dec 2026. Until then ask the district agriculture or fisheries office.' }, src: ['cmnews-agrimap'] },
  ],

  contacts: [
    { n: '1650', th: 'กรมควบคุมมลพิษ · แจ้งเรื่องมลพิษ', en: 'Pollution Control Department · report pollution' },
    { n: '1422', th: 'กรมควบคุมโรค · ปรึกษาเรื่องสุขภาพ', en: 'Department of Disease Control · health advice' },
    { n: '1784', th: 'ปภ. · สาธารณภัย', en: 'Disaster Prevention and Mitigation' },
    { n: '1669', th: 'เจ็บป่วยฉุกเฉิน', en: 'Medical emergency' },
  ],

  /* water planning — Sphere Handbook basic survival needs, litres per person per day */
  water: {
    drink: 3, cookLow: 3, cookHigh: 6, hygieneLow: 2, hygieneHigh: 6,
    containers: [
      { l: 18.9, th: 'ถังน้ำดื่ม 18.9 ลิตร', en: '18.9-litre water jug' },
      { l: 6, th: 'แกลลอน 6 ลิตร', en: '6-litre bottle' },
      { l: 1.5, th: 'ขวด 1.5 ลิตร', en: '1.5-litre bottle' },
    ],
    src: ['sphere'],
  },

  sources: {
    'komchadluek-pcd': { outlet: 'คมชัดลึก', title: 'กรมควบคุมมลพิษ เกาะติดสถานการณ์แม่น้ำสาย เจอสารหนูปนเปื้อน 25 เท่า', url: 'https://www.komchadluek.net/news/general-news/625456', date: '2026-11' },
    'thaipbs-pcd': { outlet: 'Thai PBS', title: 'คพ.เกาะติดสารหนูปนเปื้อนแม่น้ำสายเชียงราย เร่งตรวจสอบ-ลุยแก้ต้นตอมลพิษ', url: 'https://www.thaipbs.or.th/news/content/572485', date: '2026-11' },
    'lanner-r22': { outlet: 'Lanner', title: 'ผลตรวจน้ำครั้งที่ 22 ‘กก–สาย–รวก–โขง’ พบสารหนูเกินมาตรฐาน ‘แม่น้ำสาย’ ตะกั่วเกินทั้ง 3 จุด', url: 'https://lannernews.com/21092569-01/', date: '2026-09-21' },
    'hfocus-moph': { outlet: 'Hfocus', title: 'สธ. เตือนปชช.พื้นที่เสี่ยง เลี่ยงน้ำปนเปื้อน "สารหนู"', url: 'https://www.hfocus.org/content/2026/11/40221', date: '2026-11' },
    'thaipbs-moph': { outlet: 'Thai PBS', title: 'สธ.ยังไม่พบผู้ป่วยพิษสารหนู กลุ่มเสี่ยงริมแม่น้ำกก-แม่น้ำสาย-แม่น้ำรวก-แม่น้ำโขง', url: 'https://www.thaipbs.or.th/news/content/573111', date: '2026-11' },
    'posttoday-4level': { outlet: 'Post Today', title: 'เกณฑ์วัดสารหนูในน้ำ 4 ระดับ สธ.จ่อใช้', url: 'https://www.posttoday.com/smart-life/752350', date: '2026-11' },
    'pptv-weir': { outlet: 'PPTV', title: 'รัฐบาลดันฝายอัจฉริยะสกัดสารหนู เผยผลตรวจน้ำดื่ม-น้ำแข็ง 30 ตัวอย่างผ่านทั้งหมด', url: 'https://pptvhd36.com/news/%E0%B8%AA%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%A1/287593', date: '2026-11-22' },
    'thairath-6': { outlet: 'ไทยรัฐ', title: '“ยศชนัน” ลุย 6 มาตรการด่วน ดัน “ฝายดักตะกอนอัจฉริยะ” ป้องนาข้าว 2.7 หมื่นไร่', url: 'https://www.thairath.co.th/news/politic/2973676', date: '2026-11' },
    'naewna-pm': { outlet: 'แนวหน้า', title: 'นายกฯ ถกแก้สารหนูปนเปื้อนแม่น้ำกก-แม่น้ำสาย ตั้ง “ยศชนัน” คุมทีมบูรณาการ', url: 'https://www.naewna.com/n/top-stories/184972/', date: '2026-11-21' },
    'cmnews-agrimap': { outlet: 'Chiang Mai News', title: 'รัฐบาลเร่งเครื่องแก้วิกฤตสารหนูแม่น้ำกก–สาย', url: 'https://www.chiangmainews.co.th/news/4216893/', date: '2026-11' },
    'nation-fingerprint': { outlet: 'The Nation', title: 'Thailand to present arsenic ‘fingerprints’ at talks with Myanmar and China', url: 'https://www.nationthailand.com/news/general/40073812', date: '2026-11' },
    'nation-cost': { outlet: 'The Nation', title: 'Mae Sai households bear extra water costs amid arsenic pollution', url: 'https://www.nationthailand.com/news/general/40073611', date: '2026-11' },
    'nation-supply': { outlet: 'The Nation', title: 'Arsenic contamination disrupts water supply to Chiang Rai villages', url: 'https://www.nationthailand.com/news/general/40073283', date: '2026-11' },
    'aljazeera-water': { outlet: 'Al Jazeera', title: 'Myanmar-linked arsenic pollution prompts clean water scramble in Thailand', url: 'https://www.aljazeera.com/news/2026/11/18/arsenic-pollution-linked-to-myanmar-mining-prompts-water-alert-in-thailand', date: '2026-11-18' },
    'thestar-water': { outlet: 'The Star', title: 'Govt orders clean water for thousands facing arsenic pollution', url: 'https://www.thestar.com.my/aseanplus/aseanplus-news/2026/11/19/govt-orders-clean-water-for-thousands-facing-arsenic-pollution', date: '2026-11-19' },
    'diplomat-ban': { outlet: 'The Diplomat', title: 'Thailand to Ban Export of Mining Chemicals Believed Responsible For Crossborder River Contamination', url: 'https://thediplomat.com/2026/11/thailand-to-ban-export-of-mining-chemicals-believed-responsible-for-crossborder-river-contamination', date: '2026-11' },
    'nns-embankment': { outlet: 'Northern News Thailand', title: 'ทหารซ่อมแซมและเสริมความแข็งแรงพนังกั้นน้ำกึ่งถาวร พนังกั้นแม่น้ำสายคืบหน้ากว่า 60%', url: 'https://northernnewsthailand.com/news/138115', date: '2026' },
    'who-arsenic': { outlet: 'WHO', title: 'Arsenic — fact sheet', url: 'https://www.who.int/news-room/fact-sheets/detail/arsenic', date: null },
    'sphere': { outlet: 'Sphere Handbook', title: 'Water supply standard — basic survival water needs', url: 'https://spherestandards.org/handbook/', date: null },
  },
}
