// Tokens de aparência compartilhados pela biblioteca inteira.
// Um jogo novo herda tema claro/escuro e paletas sem reimplementar nada.
export const PALETTES = {
  purple: {
    dark:  { accent:'#bf8cff', button:'#bf8cff', ink:'#241136', warn:'#ff8a8a',
             bricks:['#bd8afa','#da92f4','#a298fb','#ed94d1','#ba78ec'] },
    light: { accent:'#7936bd', button:'#7e38c3', ink:'#ffffff', warn:'#b8253f',
             bricks:['#8c49c5','#b748b3','#7455c5','#bb468e','#9642ba'] }
  },
  red: {
    dark:  { accent:'#ff7389', button:'#ff8398', ink:'#3b1019', warn:'#ffc46b',
             bricks:['#ff7d94','#f497b7','#dc7cc9','#ff9678','#d58cef'] },
    light: { accent:'#be2446', button:'#c62a4b', ink:'#ffffff', warn:'#8a4a05',
             bricks:['#c33451','#b93f75','#a74896','#c64b35','#9145b4'] }
  },
  orange: {
    dark:  { accent:'#ffa369', button:'#ffaa72', ink:'#3c1c0b', warn:'#ff7d7d',
             bricks:['#ffa368','#ffb685','#ff807d','#db8ceb','#f9c571'] },
    light: { accent:'#b54a11', button:'#bb4c13', ink:'#ffffff', warn:'#a3202f',
             bricks:['#bf5b1e','#b66b22','#c24456','#9251b9','#a8701a'] }
  },
  cyan: {
    dark:  { accent:'#5fd5ff', button:'#68d9ff', ink:'#04252f', warn:'#ff8a8a',
             bricks:['#63d4ff','#7ee0e0','#8bb8ff','#5fe0b8','#9ad2ff'] },
    light: { accent:'#0d6f92', button:'#0f7699', ink:'#ffffff', warn:'#b8253f',
             bricks:['#1a7a9c','#178a8a','#3a6db8','#12876a','#2f7fae'] }
  }
};

export function createTheme(store, { onChange } = {}) {
  let mode = store.get('theme', 'dark');
  let choice = store.get('palette', 'auto');
  let autoName = 'purple';
  let tokens = PALETTES.purple.dark;

  function apply() {
    const name = choice === 'auto' ? autoName : choice;
    tokens = (PALETTES[name] || PALETTES.purple)[mode === 'light' ? 'light' : 'dark'];
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.setProperty('--accent', tokens.accent);
    root.style.setProperty('--button', tokens.button);
    root.style.setProperty('--button-text', tokens.ink);
    root.style.setProperty('--warn', tokens.warn);
    root.style.setProperty('--glow', tokens.accent + '25');
    root.style.setProperty('--wash', tokens.accent + '10');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', mode === 'light' ? '#f4f1fa' : '#0d0915');
    if (onChange) onChange(tokens, mode);
  }

  apply();

  return {
    get tokens() { return tokens; },
    get mode() { return mode; },
    get choice() { return choice; },
    get dark() { return mode !== 'light'; },
    setMode(value) { mode = value === 'light' ? 'light' : 'dark'; store.set('theme', mode); apply(); },
    toggleMode() { this.setMode(mode === 'dark' ? 'light' : 'dark'); },
    setChoice(value) { choice = value; store.set('palette', value); apply(); },
    // Cada fase pode sugerir uma paleta; só vale quando o jogador escolheu "auto".
    setAuto(name) { if (autoName !== name) { autoName = name; if (choice === 'auto') apply(); } }
  };
}
