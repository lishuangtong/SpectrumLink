const PROVIDERS = Object.freeze({
  amvlab: Object.freeze({
    root: 'https://cdn.jsdelivr.net/gh/amvlab/aircraft-models@91d835e8e851b2317fe79af291c9fed6153fd525/models/',
    sourcePage: 'https://github.com/amvlab/aircraft-models', license: 'CC BY 4.0',
  }),
  'gods-eye-view': Object.freeze({
    root: 'https://cdn.jsdelivr.net/gh/bilawalsidhu/gods-eye-view@d544613aaeb25efc06eab7f62731b99eb909c18f/public/models/',
    sourcePage: 'https://github.com/bilawalsidhu/gods-eye-view', license: 'CC BY 4.0',
  }),
  fr24: Object.freeze({
    root: 'https://ghproxy.net/https://raw.githubusercontent.com/Flightradar24/fr24-3d-models/dd53267690c6a4ecbb290a3acf0284333a5d68a9/models/',
    sourcePage: 'https://github.com/Flightradar24/fr24-3d-models', license: 'GPL-2.0',
  }),
});

const asset = (provider, filename, label, match = 'exact') => Object.freeze({ provider, filename, label, match });

const MODELS = Object.freeze({
  A320: asset('amvlab', 'A320_nologo.glb', 'AMV Lab A320'),
  A350: asset('amvlab', 'A350_nologo.glb', 'AMV Lab A350'),
  A380: asset('amvlab', 'A380_nologo.glb', 'AMV Lab A380'),
  B737: asset('amvlab', 'B737_nologo.glb', 'AMV Lab B737'),
  B787: asset('amvlab', 'B787_nologo.glb', 'AMV Lab B787'),
  A19N: asset('amvlab', 'A320_nologo.glb', 'AMV Lab A320 family', 'family'),
  A20N: asset('amvlab', 'A320_nologo.glb', 'AMV Lab A320 family', 'family'),
  A21N: asset('amvlab', 'A320_nologo.glb', 'AMV Lab A320 family', 'family'),
  A388: asset('amvlab', 'A380_nologo.glb', 'AMV Lab A380-800', 'family'),
  A35K: asset('amvlab', 'A350_nologo.glb', 'AMV Lab A350 family', 'family'),
  B38M: asset('amvlab', 'B737_nologo.glb', 'AMV Lab B737 MAX family', 'family'),
  B39M: asset('amvlab', 'B737_nologo.glb', 'AMV Lab B737 MAX family', 'family'),
  B78X: asset('amvlab', 'B787_nologo.glb', 'AMV Lab B787 family', 'family'),

  B747: asset('gods-eye-view', 'airplane.glb', 'God’s Eye View B747'),
  B789: asset('gods-eye-view', 'b789.glb', 'God’s Eye View B787-9'),
  AT72: asset('gods-eye-view', 'atr72.glb', 'God’s Eye View ATR72-600'),
  AT75: asset('gods-eye-view', 'atr72.glb', 'God’s Eye View ATR72 family', 'family'),
  AT76: asset('gods-eye-view', 'atr72.glb', 'God’s Eye View ATR72-600'),
  C172: asset('gods-eye-view', 'c172.glb', 'God’s Eye View Cessna 172'),
  C550: asset('gods-eye-view', 'citation2.glb', 'God’s Eye View Citation II'),
  B06: asset('gods-eye-view', 'bell206.glb', 'God’s Eye View Bell 206'),
  MQ9: asset('gods-eye-view', 'mq9.glb', 'God’s Eye View MQ-9'),

  A318: asset('fr24', 'a318.glb', 'FR24 A318'), A319: asset('fr24', 'a319.glb', 'FR24 A319'),
  A321: asset('fr24', 'a321.glb', 'FR24 A321'), A332: asset('fr24', 'a332.glb', 'FR24 A330-200'),
  A333: asset('fr24', 'a333.glb', 'FR24 A330-300'), A343: asset('fr24', 'a343.glb', 'FR24 A340-300'),
  A346: asset('fr24', 'a346.glb', 'FR24 A340-600'), A359: asset('fr24', 'a359.glb', 'FR24 A350-900'),
  B736: asset('fr24', 'b736.glb', 'FR24 B737-600'), B738: asset('fr24', 'b738.glb', 'FR24 B737-800'),
  B739: asset('fr24', 'b739.glb', 'FR24 B737-900'), B744: asset('fr24', 'b744.glb', 'FR24 B747-400'),
  B748: asset('fr24', 'b748.glb', 'FR24 B747-8'), B752: asset('fr24', 'b752.glb', 'FR24 B757-200'),
  B753: asset('fr24', 'b753.glb', 'FR24 B757-300'), B762: asset('fr24', 'b762.glb', 'FR24 B767-200'),
  B763: asset('fr24', 'b763.glb', 'FR24 B767-300'), B764: asset('fr24', 'b764.glb', 'FR24 B767-400'),
  B772: asset('fr24', 'b772.glb', 'FR24 B777-200'), B773: asset('fr24', 'b773.glb', 'FR24 B777-300'),
  B77L: asset('fr24', 'b772.glb', 'FR24 B777-200 family', 'family'),
  B77W: asset('fr24', 'b773.glb', 'FR24 B777-300 family', 'family'),
  B788: asset('fr24', 'b788.glb', 'FR24 B787-8'),
  E170: asset('fr24', 'e170.glb', 'FR24 E170'), E175: asset('fr24', 'e170.glb', 'FR24 E170 family', 'family'),
  E75L: asset('fr24', 'e170.glb', 'FR24 E170 family', 'family'), E75S: asset('fr24', 'e170.glb', 'FR24 E170 family', 'family'),
  E190: asset('fr24', 'e190.glb', 'FR24 E190'), E195: asset('fr24', 'e190.glb', 'FR24 E190 family', 'family'),
  CRJ7: asset('fr24', 'crj700.glb', 'FR24 CRJ700'), CRJ9: asset('fr24', 'crj900.glb', 'FR24 CRJ900'),
  DH8D: asset('fr24', 'q400.glb', 'FR24 Dash 8 Q400'),
  C56X: asset('fr24', 'citation.glb', 'FR24 Citation family', 'family'),
  PA28: asset('fr24', 'pa28.glb', 'FR24 Piper PA-28'), B146: asset('fr24', 'bae146.glb', 'FR24 BAe 146'),
  A3ST: asset('fr24', 'beluga.glb', 'FR24 Airbus Beluga'),
});

export function aircraftModelAsset(type) {
  const code = String(type || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{2,5}$/.test(code)) return null;
  const model = MODELS[code];
  if (!model) return null;
  const provider = PROVIDERS[model.provider];
  return {
    provider: model.provider,
    filename: model.filename,
    sourceUrl: `${provider.root}${model.filename}`,
    sourcePage: provider.sourcePage,
    license: provider.license,
    label: model.label,
    match: model.match,
  };
}
