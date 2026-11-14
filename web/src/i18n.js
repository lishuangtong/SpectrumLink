export const DEFAULT_LOCALE = 'zh-CN';

export const SUPPORTED_LOCALES = Object.freeze([
  { code: 'zh-CN', label: '简体中文' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'en', label: 'English' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ar', label: 'العربية' },
  { code: 'hi', label: 'हिन्दी' },
]);

const zh = {
  'app.title': 'SpectrumLink · UV-K1 全景仪表台',
  'language.name': '语言', 'language.hint': '切换后立即生效，并会记住你的选择。',
  'settings.title': '仪表台设置', 'settings.open': '打开设置', 'settings.close': '关闭设置',
  'connection.title': '电台连接', 'connection.connect': '连接 K1', 'connection.demo': '演示', 'connection.disconnect': '断开',
  'connection.localStandby': '本地待机', 'connection.selecting': '选择设备', 'connection.waiting': '等待 K1', 'connection.ready': 'K1 已连接',
  'connection.disconnected': '未连接', 'connection.error': '连接错误', 'connection.cancelled': '已取消', 'connection.failed': '连接失败',
  'scan.title': '扫描控制', 'scan.pause': '暂停', 'scan.resume': '继续', 'scan.clear': '清空历史', 'scan.center': '中心频率 MHz',
  'scan.span': '扫描跨度', 'scan.selected': '所选频率：', 'scan.none': '未选择', 'scan.monitor': '监听所选频率', 'scan.stopMonitor': '停止监听',
  'charts.title': '图表显示', 'charts.depth': '历史深度', 'charts.gain': '色彩增益', 'charts.height': '垂直高度', 'charts.auto': '自动刻度', 'charts.peak': '峰值保持',
  'identity.title': '身份信息', 'identity.nickname': '网名', 'identity.city': '所在城市', 'identity.primaryCallsign': '主呼号', 'identity.secondaryCallsign': '第二呼号（可留空）',
  'identity.callsignColor': '呼号颜色', 'identity.cityColor': '城市颜色', 'identity.callsignSize': '呼号大小', 'identity.citySize': '城市大小', 'identity.avatar': '头像', 'identity.slogan': '个性 Slogan',
  'radar.title': '飞机雷达', 'radar.latitude': '纬度', 'radar.longitude': '经度', 'radar.radius': '半径（海里）', 'radar.useLocation': '使用当前位置',
  'radar.terrainSource': '三维地形来源', 'radar.local3d': '本地 3D 地形（无需网络）', 'radar.open3d': '在线开源 3D（无需密钥）', 'radar.flat2d': '二维卫星后备',
  'radar.notice': '雷达来自网络 ADS-B，不是 K1 解码结果。', 'radar.nearby': '附近飞机雷达', 'radar.preparing': '准备中', 'radar.liveCount': '实时 · {count}', 'radar.unavailable': '数据不可用',
  'airspace.nearby': '附近', 'airspace.nearest': '最近', 'airspace.highest': '最高', 'airspace.latency': '延迟', 'airspace.countValue': '{count} 架', 'airspace.waiting': '等待数据', 'airspace.unavailable': '不可用', 'airspace.updated': '更新', 'airspace.pendingUpdate': '等待更新', 'airspace.interrupted': '连接中断',
  'layout.title': '布局与导出', 'layout.reset': '恢复默认布局', 'layout.screenshot': '导出截图', 'layout.diagnostics': '诊断信息', 'settings.save': '保存个性化',
  'modules.drag': '拖动', 'modules.contacts': '最近通联', 'modules.terrain': '三维频谱地形', 'modules.live': '实时频谱', 'modules.waterfall': '瀑布图',
  'modules.noise': '噪声底', 'modules.strong': '强信号', 'modules.chooseFrequency': '点击瀑布图选择监听频率',
  'aircraft.waiting': '等待航班', 'aircraft.carousel': '实时轮播', 'aircraft.details': '详情', 'aircraft.noTarget': '当前无目标', 'aircraft.detailTitle': '航班详情',
  'aircraft.loading': '正在读取航班资料…', 'aircraft.loadingMore': '正在读取机型、运营方和航线资料…', 'aircraft.currentOnly': '已显示当前实时飞行参数。',
  'qso.add': '新增通联', 'qso.edit': '编辑通联', 'qso.date': '日期', 'qso.time': '时间', 'qso.callsign': '呼号', 'qso.delete': '删除', 'qso.cancel': '取消', 'qso.save': '保存',
  'qso.qth': 'QTH', 'qso.waiting': '等待通联', 'qso.empty': '暂无记录', 'qso.editAria': '编辑 {callsign} 通联记录',
  'rf.active': 'RX ACTIVE', 'rf.waiting': '等待信号', 'rf.qsoTab': '最近通联', 'rf.eventsTab': 'RF 事件', 'rf.empty': '等待信号活动',
  'rf.sensitivity': 'RF 活动灵敏度', 'rf.sensitivityHint': '超过自适应噪声底的门限；数值越大越不容易误报。',
  'field.icao': 'ICAO 地址', 'field.registration': '注册号', 'field.type': '机型', 'field.manufacturer': '制造商', 'field.operator': '运营方', 'field.airline': '航空公司', 'field.route': '航线', 'field.origin': '起飞机场', 'field.destination': '到达机场', 'field.altitude': '高度', 'field.speed': '地速', 'field.heading': '航向', 'field.verticalRate': '垂直速率', 'field.squawk': '应答机', 'field.distance': '距离', 'field.bearing': '方位', 'field.coordinates': '坐标',
  'fullscreen.enter': '全屏', 'fullscreen.exit': '退出全屏（Esc）',
};

const en = {
  'app.title': 'SpectrumLink · UV-K1 panoramic dashboard', 'language.name': 'Language', 'language.hint': 'Changes apply instantly and are remembered.',
  'settings.title': 'Dashboard settings', 'settings.open': 'Open settings', 'settings.close': 'Close settings',
  'connection.title': 'Radio connection', 'connection.connect': 'Connect K1', 'connection.demo': 'Demo', 'connection.disconnect': 'Disconnect', 'connection.localStandby': 'Local standby',
  'connection.selecting': 'Select device', 'connection.waiting': 'Waiting for K1', 'connection.ready': 'K1 connected', 'connection.disconnected': 'Disconnected', 'connection.error': 'Connection error', 'connection.cancelled': 'Cancelled', 'connection.failed': 'Connection failed',
  'scan.title': 'Scan controls', 'scan.pause': 'Pause', 'scan.resume': 'Resume', 'scan.clear': 'Clear history', 'scan.center': 'Center frequency MHz', 'scan.span': 'Scan span', 'scan.selected': 'Selected frequency:', 'scan.none': 'None', 'scan.monitor': 'Monitor selected frequency', 'scan.stopMonitor': 'Stop monitoring',
  'charts.title': 'Chart display', 'charts.depth': 'History depth', 'charts.gain': 'Color gain', 'charts.height': 'Vertical height', 'charts.auto': 'Auto scale', 'charts.peak': 'Peak hold',
  'identity.title': 'Identity', 'identity.nickname': 'Nickname', 'identity.city': 'City', 'identity.primaryCallsign': 'Primary callsign', 'identity.secondaryCallsign': 'Second callsign (optional)', 'identity.callsignColor': 'Callsign color', 'identity.cityColor': 'City color', 'identity.callsignSize': 'Callsign size', 'identity.citySize': 'City size', 'identity.avatar': 'Avatar', 'identity.slogan': 'Personal slogan',
  'radar.title': 'Aircraft radar', 'radar.latitude': 'Latitude', 'radar.longitude': 'Longitude', 'radar.radius': 'Radius (NM)', 'radar.useLocation': 'Use current location', 'radar.terrainSource': '3D terrain source', 'radar.local3d': 'Local 3D terrain (offline)', 'radar.open3d': 'Open online 3D (no key)', 'radar.flat2d': '2D satellite fallback', 'radar.notice': 'Radar uses network ADS-B data, not K1 decoding.', 'radar.nearby': 'Nearby aircraft radar', 'radar.preparing': 'Preparing', 'radar.liveCount': 'Live · {count}', 'radar.unavailable': 'Data unavailable',
  'airspace.nearby': 'Nearby', 'airspace.nearest': 'Nearest', 'airspace.highest': 'Highest', 'airspace.latency': 'Latency', 'airspace.countValue': '{count} AC', 'airspace.waiting': 'Waiting', 'airspace.unavailable': 'Unavailable', 'airspace.updated': 'updated', 'airspace.pendingUpdate': 'Awaiting update', 'airspace.interrupted': 'Connection lost',
  'layout.title': 'Layout & export', 'layout.reset': 'Reset layout', 'layout.screenshot': 'Export screenshot', 'layout.diagnostics': 'Diagnostics', 'settings.save': 'Save personalization',
  'modules.drag': 'drag', 'modules.contacts': 'Recent contacts', 'modules.terrain': '3D spectrum terrain', 'modules.live': 'Live spectrum', 'modules.waterfall': 'Waterfall', 'modules.noise': 'Noise floor', 'modules.strong': 'Strong signal', 'modules.chooseFrequency': 'Click the waterfall to choose a monitoring frequency',
  'aircraft.waiting': 'Waiting for flight', 'aircraft.carousel': 'Live carousel', 'aircraft.details': 'Details', 'aircraft.noTarget': 'No current target', 'aircraft.detailTitle': 'Flight details', 'aircraft.loading': 'Loading flight data…', 'aircraft.loadingMore': 'Loading aircraft, operator and route data…', 'aircraft.currentOnly': 'Showing current live flight parameters.',
  'qso.add': 'Add contact', 'qso.edit': 'Edit contact', 'qso.date': 'Date', 'qso.time': 'Time', 'qso.callsign': 'Callsign', 'qso.delete': 'Delete', 'qso.cancel': 'Cancel', 'qso.save': 'Save',
  'qso.qth': 'QTH', 'qso.waiting': 'Waiting for contact', 'qso.empty': 'No records', 'qso.editAria': 'Edit {callsign} contact',
  'rf.active': 'RX ACTIVE', 'rf.waiting': 'Waiting', 'rf.qsoTab': 'Recent QSO', 'rf.eventsTab': 'RF events', 'rf.empty': 'Waiting for RF activity',
  'rf.sensitivity': 'RF activity sensitivity', 'rf.sensitivityHint': 'Threshold above the adaptive noise floor; higher values reduce false triggers.',
  'field.icao': 'ICAO address', 'field.registration': 'Registration', 'field.type': 'Aircraft type', 'field.manufacturer': 'Manufacturer', 'field.operator': 'Operator', 'field.airline': 'Airline', 'field.route': 'Route', 'field.origin': 'Origin airport', 'field.destination': 'Destination airport', 'field.altitude': 'Altitude', 'field.speed': 'Ground speed', 'field.heading': 'Heading', 'field.verticalRate': 'Vertical rate', 'field.squawk': 'Squawk', 'field.distance': 'Distance', 'field.bearing': 'Bearing', 'field.coordinates': 'Coordinates',
  'fullscreen.enter': 'Fullscreen', 'fullscreen.exit': 'Exit fullscreen (Esc)',
};

const packs = {
  'zh-CN': zh,
  'zh-TW': { 'language.name': '語言', 'language.hint': '切換後立即生效，並會記住你的選擇。', 'settings.title': '儀表板設定', 'connection.title': '電台連線', 'connection.connect': '連線 K1', 'connection.demo': '演示', 'connection.disconnect': '斷開', 'scan.title': '掃描控制', 'charts.title': '圖表顯示', 'identity.title': '身分資訊', 'radar.title': '飛機雷達', 'layout.title': '佈局與匯出', 'settings.save': '儲存個人化', 'modules.contacts': '最近通聯', 'modules.terrain': '三維頻譜地形', 'modules.live': '即時頻譜', 'modules.waterfall': '瀑布圖', 'radar.nearby': '附近飛機雷達', 'aircraft.details': '詳情' },
  en,
  ja: { 'language.name': '言語', 'language.hint': '変更はすぐに反映され、記憶されます。', 'settings.title': 'ダッシュボード設定', 'connection.title': '無線機接続', 'connection.connect': 'K1に接続', 'connection.demo': 'デモ', 'connection.disconnect': '切断', 'scan.title': 'スキャン制御', 'charts.title': 'チャート表示', 'identity.title': 'プロフィール', 'radar.title': '航空機レーダー', 'layout.title': 'レイアウトと出力', 'settings.save': 'カスタマイズを保存', 'modules.contacts': '最近の交信', 'modules.terrain': '3Dスペクトラム地形', 'modules.live': 'リアルタイムスペクトラム', 'modules.waterfall': 'ウォーターフォール', 'radar.nearby': '周辺航空機レーダー', 'aircraft.details': '詳細' },
  ko: { 'language.name': '언어', 'language.hint': '변경 사항은 즉시 적용되며 저장됩니다.', 'settings.title': '대시보드 설정', 'connection.title': '무전기 연결', 'connection.connect': 'K1 연결', 'connection.demo': '데모', 'connection.disconnect': '연결 해제', 'scan.title': '스캔 제어', 'charts.title': '차트 표시', 'identity.title': '사용자 정보', 'radar.title': '항공기 레이더', 'layout.title': '레이아웃 및 내보내기', 'settings.save': '개인 설정 저장', 'modules.contacts': '최근 교신', 'modules.terrain': '3D 스펙트럼 지형', 'modules.live': '실시간 스펙트럼', 'modules.waterfall': '워터폴', 'radar.nearby': '근처 항공기 레이더', 'aircraft.details': '상세' },
  es: { 'language.name': 'Idioma', 'language.hint': 'Los cambios se aplican al instante y se recuerdan.', 'settings.title': 'Ajustes del panel', 'connection.title': 'Conexión de radio', 'connection.connect': 'Conectar K1', 'connection.demo': 'Demostración', 'connection.disconnect': 'Desconectar', 'scan.title': 'Controles de escaneo', 'charts.title': 'Visualización de gráficos', 'identity.title': 'Identidad', 'radar.title': 'Radar de aeronaves', 'layout.title': 'Diseño y exportación', 'settings.save': 'Guardar personalización', 'modules.contacts': 'Contactos recientes', 'modules.terrain': 'Terreno espectral 3D', 'modules.live': 'Espectro en vivo', 'modules.waterfall': 'Cascada', 'radar.nearby': 'Radar de aeronaves cercanas', 'aircraft.details': 'Detalles' },
  fr: { 'language.name': 'Langue', 'language.hint': 'Les modifications sont immédiates et mémorisées.', 'settings.title': 'Réglages du tableau de bord', 'connection.title': 'Connexion radio', 'connection.connect': 'Connecter le K1', 'connection.demo': 'Démo', 'connection.disconnect': 'Déconnecter', 'scan.title': 'Commandes de balayage', 'charts.title': 'Affichage des graphiques', 'identity.title': 'Identité', 'radar.title': 'Radar aérien', 'layout.title': 'Disposition et export', 'settings.save': 'Enregistrer la personnalisation', 'modules.contacts': 'Contacts récents', 'modules.terrain': 'Relief spectral 3D', 'modules.live': 'Spectre en direct', 'modules.waterfall': 'Chute d’eau', 'radar.nearby': 'Radar des avions proches', 'aircraft.details': 'Détails' },
  de: { 'language.name': 'Sprache', 'language.hint': 'Änderungen gelten sofort und werden gespeichert.', 'settings.title': 'Dashboard-Einstellungen', 'connection.title': 'Funkverbindung', 'connection.connect': 'K1 verbinden', 'connection.demo': 'Demo', 'connection.disconnect': 'Trennen', 'scan.title': 'Scan-Steuerung', 'charts.title': 'Diagrammanzeige', 'identity.title': 'Identität', 'radar.title': 'Flugzeugradar', 'layout.title': 'Layout und Export', 'settings.save': 'Personalisierung speichern', 'modules.contacts': 'Letzte Kontakte', 'modules.terrain': '3D-Spektrumlandschaft', 'modules.live': 'Live-Spektrum', 'modules.waterfall': 'Wasserfall', 'radar.nearby': 'Flugzeuge in der Nähe', 'aircraft.details': 'Details' },
  pt: { 'language.name': 'Idioma', 'language.hint': 'As alterações são aplicadas imediatamente e guardadas.', 'settings.title': 'Definições do painel', 'connection.title': 'Ligação do rádio', 'connection.connect': 'Ligar K1', 'connection.demo': 'Demonstração', 'connection.disconnect': 'Desligar', 'scan.title': 'Controlos de varrimento', 'charts.title': 'Exibição de gráficos', 'identity.title': 'Identidade', 'radar.title': 'Radar de aeronaves', 'layout.title': 'Layout e exportação', 'settings.save': 'Guardar personalização', 'modules.contacts': 'Contactos recentes', 'modules.terrain': 'Terreno espectral 3D', 'modules.live': 'Espectro ao vivo', 'modules.waterfall': 'Cascata', 'radar.nearby': 'Radar de aeronaves próximas', 'aircraft.details': 'Detalhes' },
  ru: { 'language.name': 'Язык', 'language.hint': 'Изменения применяются сразу и сохраняются.', 'settings.title': 'Настройки панели', 'connection.title': 'Подключение радио', 'connection.connect': 'Подключить K1', 'connection.demo': 'Демо', 'connection.disconnect': 'Отключить', 'scan.title': 'Управление сканированием', 'charts.title': 'Отображение графиков', 'identity.title': 'Профиль', 'radar.title': 'Радар самолётов', 'layout.title': 'Макет и экспорт', 'settings.save': 'Сохранить', 'modules.contacts': 'Недавние связи', 'modules.terrain': '3D-рельеф спектра', 'modules.live': 'Спектр', 'modules.waterfall': 'Водопад', 'radar.nearby': 'Радар ближайших самолётов', 'aircraft.details': 'Подробности' },
  ar: { 'language.name': 'اللغة', 'language.hint': 'تطبق التغييرات فورًا ويتم حفظها.', 'settings.title': 'إعدادات لوحة القيادة', 'connection.title': 'اتصال الراديو', 'connection.connect': 'توصيل K1', 'connection.demo': 'عرض', 'connection.disconnect': 'قطع الاتصال', 'scan.title': 'عناصر المسح', 'charts.title': 'عرض الرسوم', 'identity.title': 'الهوية', 'radar.title': 'رادار الطائرات', 'layout.title': 'التخطيط والتصدير', 'settings.save': 'حفظ التخصيص', 'modules.contacts': 'آخر الاتصالات', 'modules.terrain': 'طيف ثلاثي الأبعاد', 'modules.live': 'الطيف المباشر', 'modules.waterfall': 'الشلال', 'radar.nearby': 'رادار الطائرات القريبة', 'aircraft.details': 'التفاصيل' },
  hi: { 'language.name': 'भाषा', 'language.hint': 'बदलाव तुरंत लागू होते हैं और याद रखे जाते हैं।', 'settings.title': 'डैशबोर्ड सेटिंग', 'connection.title': 'रेडियो कनेक्शन', 'connection.connect': 'K1 कनेक्ट करें', 'connection.demo': 'डेमो', 'connection.disconnect': 'डिस्कनेक्ट', 'scan.title': 'स्कैन नियंत्रण', 'charts.title': 'चार्ट डिस्प्ले', 'identity.title': 'पहचान', 'radar.title': 'विमान रडार', 'layout.title': 'लेआउट और निर्यात', 'settings.save': 'व्यक्तिगतकरण सहेजें', 'modules.contacts': 'हाल के संपर्क', 'modules.terrain': '3D स्पेक्ट्रम भूभाग', 'modules.live': 'लाइव स्पेक्ट्रम', 'modules.waterfall': 'वॉटरफॉल', 'radar.nearby': 'नजदीकी विमान रडार', 'aircraft.details': 'विवरण' },
};

export function normalizeLocale(value) {
  return SUPPORTED_LOCALES.some(({ code }) => code === value) ? value : DEFAULT_LOCALE;
}

function format(template, variables = {}) {
  return String(template).replace(/\{(\w+)\}/g, (_, key) => variables[key] ?? `{${key}}`);
}

export function createI18n(initialLocale = DEFAULT_LOCALE) {
  let locale = normalizeLocale(initialLocale);
  return {
    get locale() { return locale; },
    setLocale(next) { locale = normalizeLocale(next); return locale; },
    t(key, variables) {
      const value = packs[locale]?.[key] ?? en[key] ?? zh[key] ?? key;
      return format(value, variables);
    },
  };
}

export function applyDocumentTranslations(root, i18n) {
  root.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = i18n.t(element.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((element) => { element.title = i18n.t(element.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach((element) => { element.setAttribute('aria-label', i18n.t(element.dataset.i18nAria)); });
  const html = root.documentElement ?? root.ownerDocument?.documentElement;
  if (html) html.lang = i18n.locale;
}
