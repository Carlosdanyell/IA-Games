// Sala: criar, entrar, copiar e compartilhar os códigos. Adaptado do lobby do
// Neon Pool, que já resolve o pareamento manual em retrato e em paisagem.
// Os códigos nunca passam por innerHTML.
const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function createLanLobby({ name, onName, onCreate, onJoin, onAnswer, onLeave, onBack }) {
  const root = el('div', null, 'nx-lan');
  root.append(el('p', 'Dois aparelhos, um tabuleiro. Conectem os dois ao mesmo Wi-Fi e abram o Neon Chess. Não é preciso instalar servidor.'));
  const status = el('p', 'Crie uma sala ou entre com o convite de um amigo.', 'lan-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const field = el('label', 'Seu nome', 'lan-field');
  const nameInput = el('input');
  nameInput.value = name;
  nameInput.maxLength = 12;
  nameInput.autocomplete = 'nickname';
  field.append(nameInput);
  const choices = el('div', null, 'lan-actions');
  const create = button('Criar sala');
  const join = button('Entrar na sala');
  choices.append(create, join);
  const steps = el('div', null, 'lan-steps');
  const back = button('Voltar para o tabuleiro', onBack);
  back.hidden = true;
  const leave = button('Sair da sala', () => { generation++; onLeave(); });
  const help = el('details');
  help.append(el('summary', 'Como conectar / Não conectou?'), el('p',
    '1. Quem cria envia o convite. 2. O amigo abre o convite, toca em Gerar resposta e devolve o código. 3. Quem criou cola a resposta e toca em Conectar. O tabuleiro abre nos dois aparelhos.'), el('p',
    'Mantenham as duas páginas abertas. Compartilhem os códigos por uma conversa privada ou copiem diretamente. Se a rede tiver isolamento de aparelhos (comum em Wi-Fi de convidados), usem outra rede. VPNs e bloqueios de rede local também podem impedir a conexão. Depois que o jogo estiver salvo no aparelho, o pareamento e a partida não precisam de internet.'), el('p',
    'Ao sair do app, a partida pausa nos dois aparelhos. Para retomar ou jogar uma revanche, ambos precisam confirmar. Se alguém fechar ou recarregar a página, criem outra sala.'));
  root.append(field, choices, status, steps, back, leave, help);
  let busy = false;
  let generation = 0;

  function button(text, action) {
    const b = el('button', text, 'ghost-button');
    b.type = 'button';
    if (action) b.addEventListener('click', action);
    return b;
  }
  function textarea(label, readonly = false) {
    const wrap = el('label', label, 'lan-field');
    const input = el('textarea');
    input.rows = readonly ? 2 : 3;
    input.readOnly = readonly;
    input.spellcheck = false;
    input.autocapitalize = 'off';
    input.autocomplete = 'off';
    input.setAttribute('aria-label', label);
    wrap.append(input);
    steps.append(wrap);
    return input;
  }
  function setBusy(value) {
    busy = value;
    for (const b of root.querySelectorAll('button')) if (b !== leave && b !== back) b.disabled = value;
    nameInput.disabled = value;
  }
  async function run(action) {
    if (busy) return;
    const current = generation;
    setBusy(true);
    try { await action(); }
    catch (error) { if (generation === current) status.textContent = error.message || 'Não foi possível conectar. Tente novamente.'; }
    finally { if (generation === current) setBusy(false); }
  }
  function output(label, token, asLink) {
    const box = textarea(label, true);
    const url = new URL(location.href);
    url.hash = 'chess=' + token;
    const value = asLink ? url.href : token;
    box.value = value;
    const actions = el('div', null, 'lan-actions');
    actions.append(button(asLink ? 'Copiar convite' : 'Copiar resposta', async () => {
      try { await navigator.clipboard.writeText(value); status.textContent = 'Copiado. Envie para o outro jogador.'; }
      catch { box.focus(); box.select(); status.textContent = 'Código selecionado. Use Copiar no menu do aparelho.'; }
    }));
    if (navigator.share) actions.append(button(asLink ? 'Compartilhar convite' : 'Compartilhar resposta', async () => {
      try { await navigator.share({ title: 'Neon Chess · partida na mesma rede', text: value }); }
      catch (e) { if (e.name !== 'AbortError') status.textContent = 'Use Copiar para enviar o código.'; }
    }));
    steps.append(actions);
  }
  create.addEventListener('click', () => run(async () => {
    nameInput.value = onName(nameInput.value);
    steps.replaceChildren();
    const token = await onCreate();
    if (!root.isConnected) return;
    output('1. Envie este convite ao outro jogador', token, true);
    const answer = textarea('2. Cole a resposta do outro jogador');
    steps.append(button('Conectar', () => run(() => onAnswer(answer.value))));
  }));
  function showJoin(value = '') {
    if (busy) return;
    steps.replaceChildren();
    const offer = textarea('1. Cole o convite recebido');
    offer.value = value;
    steps.append(button('Gerar resposta', () => run(async () => {
      nameInput.value = onName(nameInput.value);
      const token = await onJoin(offer.value);
      if (!root.isConnected) return;
      steps.replaceChildren();
      output('2. Devolva esta resposta para quem criou a sala', token, false);
      steps.append(el('p', 'Aguarde. A partida abre quando o outro jogador colar sua resposta e tocar em Conectar.'));
    })));
  }
  join.addEventListener('click', () => showJoin());
  return {
    root, showJoin,
    update(state, message) {
      status.textContent = message;
      root.dataset.connection = state;
      back.hidden = state !== 'connected';
      choices.hidden = state === 'connected';
      field.hidden = state === 'connected';
      steps.hidden = state === 'connected';
      if (state === 'closed') {
        leave.textContent = 'Fechar sala';
        steps.replaceChildren(el('p', 'Use Criar sala para gerar um novo convite ou Entrar na sala para receber outro.'));
      }
    }
  };
}
