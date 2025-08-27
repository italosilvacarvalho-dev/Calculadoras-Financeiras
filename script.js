/***********************
 * Núcleo SPA + Registry
 ***********************/
const grid        = document.getElementById("grid");
const panel       = document.getElementById("panel");
const panelTitle  = document.getElementById("panelTitle");
const goHome      = document.getElementById("goHome");
const closePanel  = document.getElementById("closePanel");
const themeToggle = document.getElementById("themeToggle");

const Calculators = {}; // { key: {title, mount, unmount} }
let current = null;

function registerCalc(key, def){ Calculators[key] = def; }
function showView(id){
  document.querySelectorAll(".calc-view").forEach(v => v.classList.add("hidden"));
  document.getElementById(id)?.classList.remove("hidden");
}
function openCalc(key){
  if(current && Calculators[current]?.unmount) Calculators[current].unmount();
  const def = Calculators[key] || Calculators["placeholder"];
  panelTitle.textContent = def.title;
  grid.classList.add("hidden");
  panel.classList.remove("hidden");
  def.mount();
  current = key;
  location.hash = `#/${key}`;
}
function backHome(){
  if(current && Calculators[current]?.unmount) Calculators[current].unmount();
  panel.classList.add("hidden");
  grid.classList.remove("hidden");
  current = null;
  location.hash = "#/";
}

// navegação pelos cards
grid.addEventListener("click", (e)=>{
  const btn = e.target.closest("[data-open]");
  if(!btn) return;
  openCalc(btn.dataset.open);
});
goHome.addEventListener("click", (e)=>{e.preventDefault(); backHome();});
closePanel.addEventListener("click", backHome);

// tema (persiste)
// tema (persiste + acessibilidade + tooltip)
const THEME_KEY = "app_theme_light";

function applyThemeState(){
  const isLight = document.body.classList.contains("light");
  if (!themeToggle) return;
  themeToggle.setAttribute("aria-pressed", String(isLight));
  themeToggle.setAttribute(
    "title",
    isLight ? "Usando tema claro — clique para escuro"
            : "Usando tema escuro — clique para claro"
  );
}

// aplica o tema salvo
if (localStorage.getItem(THEME_KEY) === "1") {
  document.body.classList.add("light");
}
applyThemeState();

// alterna o tema e persiste
themeToggle?.addEventListener("click", ()=>{
  document.body.classList.toggle("light");
  localStorage.setItem(
    THEME_KEY,
    document.body.classList.contains("light") ? "1" : "0"
  );
  applyThemeState();
});


// router por hash (load + back/forward)
function bootFromHash(){
  const hash = (location.hash||"").replace("#/","");
  if(hash) openCalc(hash); else backHome();
}
window.addEventListener("load", bootFromHash);
window.addEventListener("hashchange", bootFromHash);

/*********************************
 * Helpers gerais (globais)
 *********************************/
function fmtBR(n){ return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

// cria helpers escopados à view (com fallback global p/ elementos fora da view)
function createScope(viewId){
  const base = `#${viewId}`;
  const $  = (sel)=>{
    return document.querySelector(`${base} ${sel}`) || document.querySelector(sel);
  };
  const $$ = (sel)=>{
    const scoped = document.querySelectorAll(`${base} ${sel}`);
    if(scoped && scoped.length) return scoped;
    return document.querySelectorAll(sel);
  };
  // registro de listeners para cleanup
  let listeners=[];
  const on = (el,ev,fn)=>{ if(el){ el.addEventListener(ev,fn); listeners.push([el,ev,fn]); } };
  const offAll = ()=>{ listeners.forEach(([el,ev,fn])=> el.removeEventListener(ev,fn)); listeners=[]; };
  return { $, $$, on, offAll };
}

/****************************************
 * MÓDULO: Placeholder (genérico)
 ****************************************/
registerCalc("placeholder", {
  title: "Em breve",
  mount(){ showView("view-placeholder"); },
  unmount(){ /* nada */ }
});

/****************************************
 * MÓDULO: Juros Compostos (escopado)
 ****************************************/
registerCalc("juros-compostos", (function(){
  const viewId = "view-juros-compostos";
  const { $, on, offAll } = createScope(viewId);
  let chart=null, lastResult=null;
  const STORAGE_KEY = "calc_scenarios_jc_v1";

  function simularJC(P, A, i, n){
    const linhas = [];
    let saldo = P, totalAportes = P;
    for(let m=1; m<=n; m++){
      const juros = saldo * i;
      saldo += juros + A;
      totalAportes += A;
      linhas.push({mes:m, aporte:A, juros, saldo});
    }
    const montante = saldo;
    const jurosAcum = montante - totalAportes;
    return {linhas, montante, totalAportes, jurosAcum};
  }

  function desenharGrafico(dataset){
    const labels = dataset.linhas.map(l => `M${l.mes}`);
    let accAportes = Number($("#jcInicial").value||0);
    let accJuros = 0;
    const serieMontante = dataset.linhas.map(l => l.saldo);
    const serieAportes  = dataset.linhas.map(l => accAportes += l.aporte);
    const serieJuros    = dataset.linhas.map(l => accJuros += l.juros);

    const ctx = $("#jcChart").getContext("2d");
    if(chart) chart.destroy();
    chart = new Chart(ctx, {
      type:"line",
      data:{ labels, datasets:[
        {label:"Montante", data:serieMontante, borderWidth:2, fill:false},
        {label:"Aportes",  data:serieAportes,  borderWidth:2, fill:false},
        {label:"Juros",    data:serieJuros,    borderWidth:2, fill:false},
      ]},
      options:{
        responsive:true, animation:false,
        interaction:{mode:"index", intersect:false},
        plugins:{tooltip:{callbacks:{label:(c)=>`${c.dataset.label}: ${fmtBR(c.parsed.y)}`}}},
        scales:{y:{ticks:{callback:(v)=>fmtBR(v)}}}
      }
    });
  }

  function atualizarKpis(out){
    $("#kMontante").textContent = fmtBR(out.montante);
    $("#kAportes").textContent  = fmtBR(out.totalAportes);
    $("#kJuros").textContent    = fmtBR(out.jurosAcum);
  }

  function calcular(e){
    e && e.preventDefault();
    const P = Number($("#jcInicial").value||0);
    const A = Number($("#jcAporte").value||0);
    const i = Number($("#jcTaxa").value||0)/100;
    const n = Number($("#jcMeses").value||1);
    const out = simularJC(P,A,i,n);
    atualizarKpis(out);
    desenharGrafico(out);
    lastResult = {params:{P,A,i,n}, ...out};
  }

  function exportar(){
  if(!lastResult) calcular();

  const {linhas, montante, totalAportes, jurosAcum} = lastResult;
  const toBRL = (n) => Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })
    : String(n);

  const SEP = ";";
  const rows = [];

  // Cabeçalho
  rows.push(["Mês","Aporte","Juros do mês","Saldo ao final"]);

  // Corpo
  for(const l of linhas){
    rows.push([ l.mes, toBRL(l.aporte), toBRL(l.juros), toBRL(l.saldo) ]);
  }

  // Resumo
  rows.push([]);
  rows.push(["Montante","","",           toBRL(montante)]);
  rows.push(["Total Aportado","","",     toBRL(totalAportes)]);
  rows.push(["Juros Acumulados","","",   toBRL(jurosAcum)]);

  // CSV com BOM + escape de células
  const csv = "\ufeff" + rows.map(r => r.map(c => {
    const s = String(c);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(SEP)).join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href:url, download:"cronograma-juros-compostos.csv" });
  a.click(); URL.revokeObjectURL(url);
}


  return {
    title: "Juros Compostos",
    mount(){
      // garantir que a tabela da outra calc não apareça aqui
      document.getElementById("psTableSection")?.classList.add("hidden");

      showView(viewId);
      on($("#jcForm"),   "submit", calcular);
      on($("#jcExport"), "click",  exportar);
      on($("#jcSalvar"), "click", ()=>{ $(`.saved`).open = true; $("#saveName").focus(); });
      on($("#saveNow"), "click", ()=>{
        const name = ($("#saveName").value||"").trim();
        if(!name){ alert("Dê um nome ao cenário."); return; }
        const P = Number($("#jcInicial").value||0);
        const A = Number($("#jcAporte").value||0);
        const i = Number($("#jcTaxa").value||0)/100;
        const n = Number($("#jcMeses").value||1);
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
        arr.push({name,P,A,i,n,createdAt:Date.now()});
        localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
        $("#saveName").value="";
        $("#scenarioList").insertAdjacentHTML("beforeend", `
          <li>
            <div>
              <div><strong>${name}</strong></div>
              <div class="meta">Inicial ${fmtBR(P)} • Aporte ${fmtBR(A)} • Taxa ${(i*100).toFixed(3)}% a.m. • ${n} meses</div>
            </div>
            <div class="row">
              <button class="ghost" data-load="${(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]").length-1)}">Aplicar</button>
              <button class="ghost" data-del="${(JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]").length-1)}">Excluir</button>
            </div>
          </li>`);
      });
      on($("#scenarioList"), "click", (e)=>{
        const b = e.target.closest("button"); if(!b) return;
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
        if(b.dataset.load){
          const sc = arr[Number(b.dataset.load)];
          $("#jcInicial").value=sc.P;
          $("#jcAporte").value=sc.A;
          $("#jcTaxa").value=(sc.i*100);
          $("#jcMeses").value=sc.n;
          calcular();
        }
        if(b.dataset.del){
          arr.splice(Number(b.dataset.del),1);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
          b.closest("li").remove();
        }
      });

      (function loadScenarios(){
        const ul = $("#scenarioList");
        const arr = JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");
        ul.innerHTML = "";
        arr.forEach((sc, idx)=>{
          const li = document.createElement("li");
          li.innerHTML = `
            <div>
              <div><strong>${sc.name}</strong></div>
              <div class="meta">Inicial ${fmtBR(sc.P)} • Aporte ${fmtBR(sc.A)} • Taxa ${(sc.i*100).toFixed(3)}% a.m. • ${sc.n} meses</div>
            </div>
            <div class="row">
              <button class="ghost" data-load="${idx}">Aplicar</button>
              <button class="ghost" data-del="${idx}">Excluir</button>
            </div>`;
          ul.appendChild(li);
        });
      })();

      calcular(); // inicial
    },
    unmount(){
      if(chart){ chart.destroy(); chart=null; }
      offAll();
    }
  };
})());

/****************************************
 * MÓDULO: Poupança x Selic (escopado)
 ****************************************/
registerCalc("poupanca-selic", (function () {
  const viewId = "view-poupanca-selic";
  const { $, on, offAll } = createScope(viewId);

  let chart = null, last = null, dirty = false;
  let suppressInput = false; // evita resetar a tela enquanto calculamos

  /* ===== Regras / helpers ===== */
  function taxaPoupAA(selicAA, trAA){
    if (selicAA > 8.5) { // 0,5% a.m. + TR
      const iMes = 0.005;
      const aaSemTR = (Math.pow(1 + iMes, 12) - 1) * 100;
      return aaSemTR + (trAA || 0);
    }
    return 0.7 * selicAA + (trAA || 0);
  }
  const aaToAm = (aa) => Math.pow(1 + (aa/100), 1/12) - 1;

  function simSerie(P0, A, iMes, meses){
    let saldo=P0, serie=[saldo], jurosAc=0, aportes=P0;
    for(let m=1;m<=meses;m++){
      const j = saldo*iMes;
      jurosAc += j;
      saldo += j + A;
      aportes += A;
      serie.push(saldo);
    }
    return {serie, final:saldo, jurosAc, aportes};
  }

  function aliquotaIRByDays(dias){
    if(dias<=180) return 0.225;
    if(dias<=360) return 0.20;
    if(dias<=720) return 0.175;
    return 0.15;
  }

  /* ===== UI helpers ===== */
  function markDirty(){
    dirty = true;
    const b = $("#psCalcular");
    if (b){ b.textContent = "Recalcular"; b.classList.add("attention"); }
  }
  function clearDirty(){
    dirty = false;
    const b = $("#psCalcular");
    if (b){ b.textContent = "Calcular"; b.classList.remove("attention"); }
  }

  function refreshPoupAA(){
    const selicAA = Number($("#psSelicAA").value||0);
    const trAA    = Number($("#psTR").value||0);
    const inputP  = $("#psPoupAA");
    if (inputP && inputP.readOnly){
      const next = taxaPoupAA(selicAA, trAA).toFixed(2);
      if (inputP.value !== next){
        const old = suppressInput;
        suppressInput = true;
        inputP.value = next;
        suppressInput = old;
      }
    }
  }

  function resetView(makeDirty = true){
    ["#psMontPoup","#psMontSelic","#psMontSelicLiq","#psDiff"]
      .forEach(sel=>{ const el=$(sel); if(el) el.textContent="—"; });
    if(chart){ chart.destroy(); chart=null; }
    const btn=$("#psExport");
    if(btn) btn.disabled=true;
    last=null;
    clearTable();
    if (makeDirty) markDirty(); else clearDirty();
  }

  function afterCalculated(){
    const btn=$("#psExport");
    if(btn) btn.disabled=false;
    clearDirty();
  }

  function irFaixaLabelByMonths(meses){
    const d = meses * 30;
    if (d <= 180) return "0–180 dias (22,5%)";
    if (d <= 360) return "181–360 dias (20%)";
    if (d <= 720) return "361–720 dias (17,5%)";
    return ">720 dias (15%)";
  }
  function updateIRBadge(meses){
    const badge = $("#psIRBadge");
    const ativo = !!$("#psIRAtivo")?.checked;
    if (!badge) return;
    if (ativo){
      badge.textContent = "Faixa de IR: " + irFaixaLabelByMonths(meses);
      badge.style.visibility = "visible";
    } else {
      badge.style.visibility = "hidden";
    }
  }

  // formata 12.34 -> "12,34%"
  function pctBR(x){
    return `${(Number(x)||0).toLocaleString('pt-BR',{
      minimumFractionDigits:2, maximumFractionDigits:2
    })}%`;
  }

  // === Cabeçalho enriquecido do bloco de tabela ===
  function ensureEnhancedHeader(){
    const head = $("#psTableSection .table-head");
    if (!head) return;

    head.classList.add("enhanced", "centered"); // remova "centered" se preferir à esquerda
    if (head.querySelector(".th-title")) return; // já existe

    const left = document.createElement("div");
    left.className = "th-left";
    left.innerHTML = `
      <div class="th-title">
        <span class="th-icon">📊</span>
        <h4>Detalhe mensal</h4>
        <span id="psIrChip" class="chip muted">—</span>
      </div>

      <div class="th-legend">
        <span class="dot dot-poup"></span><span>Poupança</span>
        <span class="dot dot-selic"></span><span>Selic (líquida)</span>
        <span id="psMetaExtra" class="stat" style="margin-left:10px;">—</span>
        <button id="psCopySummary" class="copy-btn" type="button" title="Copiar resumo">Copiar resumo</button>
      </div>

      <div class="th-meta">
        <span id="psMetaRange">—</span>
        <span class="sep">•</span>
        <span id="psMetaRates">—</span>
      </div>
    `;
    head.innerHTML = "";
    head.appendChild(left);
  }

  // Atualiza texto do chip/metadados do cabeçalho
  function updateTableHeadMeta(meses){
    const chip  = $("#psIrChip");
    const ativo = !!$("#psIRAtivo")?.checked;

    if (chip){
      chip.textContent = ativo ? `IR regressivo — ${irFaixaLabelByMonths(meses)}` : "IR desativado";
      chip.classList.toggle("on",  ativo);
      chip.classList.toggle("off", !ativo);
    }

    // período "X anos • Y meses"
    const range = $("#psMetaRange");
    if (range){
      const a = Math.floor(meses/12), m = meses%12;
      const parts=[]; if (a) parts.push(`${a} ano${a>1?'s':''}`); if (m) parts.push(`${m} mês${m>1?'es':''}`);
      range.textContent = parts.length ? parts.join(" • ") : "—";
    }

    // taxas atuais
    const rates = $("#psMetaRates");
    if (rates){
      const selicAA = Number($("#psSelicAA").value||0);
      const trAA    = Number($("#psTR").value||0);
      const poupAA  = Number($("#psPoupAA").value||0);
      rates.textContent = `Selic ${(selicAA).toFixed(2).replace('.',',')}%  •  Poup ${(poupAA).toFixed(2).replace('.',',')}%  •  TR ${(trAA).toFixed(2).replace('.',',')}%`;
    }

    // estatística rápida (diferença)
    const extra = $("#psMetaExtra");
    if (extra && last){
      const diff = last.finais.selicLiq - last.finais.poup;
      extra.textContent = `Diferença: ${fmtBR(diff)}`;
    }
  }

  // texto para o botão "Copiar resumo"
  function headerSummaryText(meses){
    const selicAA = Number($("#psSelicAA").value||0);
    const trAA    = Number($("#psTR").value||0);
    const poupAA  = Number($("#psPoupAA").value||0);
    const irTxt   = !!$("#psIRAtivo")?.checked ? `IR regressivo — ${irFaixaLabelByMonths(meses)}` : "IR desativado";

    const a = Math.floor(meses/12), m = meses%12;
    const periodo = [a?`${a} ano${a>1?'s':''}`:"", m?`${m} mês${m>1?'es':''}`:""].filter(Boolean).join(" • ") || `${meses} meses`;

    const dif = last ? fmtBR(last.finais.selicLiq - last.finais.poup) : "—";
    return [
      `Detalhe mensal`,
      irTxt,
      `Período: ${periodo}`,
      `Taxas — Selic ${selicAA.toFixed(2)}% • Poup ${poupAA.toFixed(2)}% • TR ${trAA.toFixed(2)}%`,
      last ? `Montantes — Poup: ${fmtBR(last.finais.poup)} • Selic (líq.): ${fmtBR(last.finais.selicLiq)} • Dif: ${dif}` : ""
    ].filter(Boolean).join("\n");
  }

  function desenhar(labels, sPoup, sSelicLiq){
    const ctx = $("#psChart").getContext("2d");
    if(chart) chart.destroy();
    chart = new Chart(ctx,{
      type:"line",
      data:{ labels, datasets:[
        {label:"Poupança", data:sPoup, borderWidth:2, fill:false},
        {label:"Selic (líquida)", data:sSelicLiq, borderWidth:2, fill:false}
      ]},
      options:{
        responsive:true, animation:false,
        interaction:{mode:"index", intersect:false},
        plugins:{tooltip:{callbacks:{label:(c)=>`${c.dataset.label}: ${fmtBR(c.parsed.y)}`}}},
        scales:{y:{ticks:{callback:(v)=>fmtBR(v)}}}
      }
    });
  }

  /* ===== Tabela paginada ===== */
  const tableState = { page: 1, perPage: parseInt($("#psPerPage")?.value || "10", 10) };

  function clearTable(){
    const tb = $("#psTbody");
    if (tb) tb.innerHTML = `<tr><td colspan="3">—</td></tr>`;
    const info = $("#psPageInfo");
    if (info) info.textContent = "";
    const prev = $("#psPrev");
    const next = $("#psNext");
    if (prev) prev.disabled = true;
    if (next) next.disabled = true;
  }

  function renderTable(){
    if (!last) { clearTable(); return; }

    const usarIR = !!$("#psIRAtivo")?.checked;
    const serieSelic = usarIR ? last.serieSelicLiq : last.serieSelicBruta;

    const thSelic = $("#thSelic");
    if (thSelic) thSelic.textContent = usarIR ? "Selic (líquida)" : "Selic (bruta)";

    const tbody = $("#psTbody");
    if (!tbody) return;

    const totalRows = Math.max(0, (last.labels?.length || 1) - 1);
    const totalPages = Math.max(1, Math.ceil(totalRows / tableState.perPage));
    tableState.page = Math.min(Math.max(1, tableState.page), totalPages);

    if (totalRows === 0){
      tbody.innerHTML = `<tr><td colspan="3">—</td></tr>`;
    } else {
      const start = (tableState.page - 1) * tableState.perPage + 1;
      const end = Math.min(totalRows, start + tableState.perPage - 1);

      let html = "";
      for (let m = start; m <= end; m++){
        html += `<tr>
          <td>${m}</td>
          <td>${fmtBR(last.seriePoup[m])}</td>
          <td>${fmtBR(serieSelic[m])}</td>
        </tr>`;
      }
      tbody.innerHTML = html;
    }

    const info = $("#psPageInfo");
    const prev = $("#psPrev");
    const next = $("#psNext");
    if (info) info.textContent = `Página ${tableState.page} de ${totalPages}`;
    if (prev) prev.disabled = tableState.page <= 1 || totalRows === 0;
    if (next) next.disabled = tableState.page >= totalPages || totalRows === 0;

    // posiciona a paginação no rodapé e atualiza o cabeçalho
    const mesesView = Math.max(1, totalRows);
    requestAnimationFrame(() => {
      movePagerToBottom();
      ensureEnhancedHeader();
      updateTableHeadMeta(mesesView);
    });
  }

  // paginação no rodapé da tabela (preserva listeners)
  function movePagerToBottom(){
    const prev = $("#psPrev");
    const info = $("#psPageInfo");
    const next = $("#psNext");
    if (!prev || !info || !next) return;

    const table = $("#psTbody")?.closest("table");
    if (!table) return;

    let bottom = $("#psPagerBottom");
    if (!bottom){
      bottom = document.createElement("div");
      bottom.id = "psPagerBottom";
      table.insertAdjacentElement("afterend", bottom);
    }

    // cria contêineres (esquerda/centro) se ainda não existirem
    let left  = bottom.querySelector(".pager-left");
    let center = bottom.querySelector(".pager-center");
    if (!left || !center){
      bottom.innerHTML = "";
      left = document.createElement("div");
      left.className = "pager-left";
      center = document.createElement("div");
      center.className = "pager-center";
      bottom.append(left, center);
    }

    // leva o seletor "Itens por página" para a esquerda
    const per = $("#psPerPage");
    const perLabel = bottom.querySelector('label[for="psPerPage"]') 
                  || Object.assign(document.createElement("label"), { 
                       htmlFor: "psPerPage", textContent: "Itens por página" 
                     });
    if (per){ left.append(perLabel, per); }

    // e o pager fica no centro
    center.append(prev, info, next);
  }

  /* ===== Cálculo ===== */
  function calcular(e){
    e && e.preventDefault();

    suppressInput = true; // inicia seção crítica

    const P0 = Number($("#psInicial").value||0);
    const A  = Number($("#psAporte").value||0);

    const rawPeriod = Number($("#psPeriodo").value);
    const period = Number.isFinite(rawPeriod) && rawPeriod > 0 ? rawPeriod : 1;
    let meses = ($("#psUnidade").value==="anos") ? period*12 : period;
    meses = Math.max(1, Math.floor(meses));

    const selicAA = Number($("#psSelicAA").value||0);
    refreshPoupAA(); // atualiza poupança sem disparar reset
    const poupAA  = Number($("#psPoupAA").value||0);

    const iSelic = aaToAm(selicAA);
    const iPoup  = aaToAm(poupAA);

    const sP = simSerie(P0,A,iPoup,meses);
    const sS = simSerie(P0,A,iSelic,meses);

    const usarIR = !!$("#psIRAtivo")?.checked;
    const diasTotais = meses*30;
    const aliq = usarIR ? aliquotaIRByDays(diasTotais) : 0;

    const jurosLiquidos = sS.jurosAc * (1-aliq);
    const montanteLiq   = sS.aportes + jurosLiquidos;

    const serieSelicLiq = sS.serie.map((val,idx)=>{
      if(idx===0) return val;
      const dias = idx*30;
      const a = usarIR ? aliquotaIRByDays(dias) : 0;
      const aportesAte = P0 + A*idx;
      const jurosAte   = Math.max(0, val - aportesAte);
      return aportesAte + jurosAte*(1-a);
    });

    $("#psMontPoup").textContent     = fmtBR(sP.final);
    $("#psMontSelic").textContent    = fmtBR(sS.final);
    $("#psMontSelicLiq").textContent = fmtBR(montanteLiq);
    $("#psDiff").textContent         = fmtBR(montanteLiq - sP.final);

    const labels = Array.from({length:meses+1},(_,i)=> i===0?"M0":`M${i}`);
    desenhar(labels, sP.serie, serieSelicLiq);

    last = {
      labels,
      seriePoup: sP.serie,
      serieSelicBruta: sS.serie,
      serieSelicLiq,
      finais:{ poup:sP.final, selicBruta:sS.final, selicLiq:montanteLiq }
    };

    suppressInput = false; // fim seção crítica

    afterCalculated();
    updateIRBadge(meses);
    updateTableHeadMeta(meses);   // atualiza cabeçalho após calcular

    tableState.page = 1;
    renderTable();
  }

  function exportCSV(){
  if(!last) return;

  const toBRL = (n) => Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" })
    : String(n);

  const SEP = ";";
  const rows = [];

  // Cabeçalho
  rows.push(["Mês","Poupança","Selic (bruta)","Selic (líquida)"]);

  // Corpo
  for(let i=0;i<last.labels.length;i++){
    rows.push([
      last.labels[i],
      toBRL(last.seriePoup[i]),
      toBRL(last.serieSelicBruta[i]),
      toBRL(last.serieSelicLiq[i])
    ]);
  }

  // Resumo
  rows.push([]);
  rows.push(["Montante Poupança","","", toBRL(last.finais.poup)]);
  rows.push(["Montante Selic (bruta)","","", toBRL(last.finais.selicBruta)]);
  rows.push(["Montante Selic (líquida)","","", toBRL(last.finais.selicLiq)]);

  // CSV com BOM + escape de células
  const csv = "\ufeff" + rows.map(r => r.map(c => {
    const s = String(c);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }).join(SEP)).join("\n");

  const url = URL.createObjectURL(new Blob([csv], { type:"text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href:url, download:"poupanca-vs-selic.csv" });
  a.click(); URL.revokeObjectURL(url);
}


  /* ===== Lifecycle ===== */
  function handleFieldChange(){
    if (suppressInput) return;
    refreshPoupAA();
    resetView(true);

    // mantém o cabeçalho coerente enquanto o usuário edita
    const raw   = Number($("#psPeriodo").value||1);
    const meses = ($("#psUnidade").value==="anos") ? (raw||1)*12 : (raw||1);
    updateTableHeadMeta(Math.max(1, Math.floor(meses)));
  }
  function handleIRToggle(e){
    e.stopPropagation();
    if(last) calcular();
    else {
      const raw = Number($("#psPeriodo").value||1);
      const meses  = ($("#psUnidade").value==="anos") ? (raw||1)*12 : (raw||1);
      updateIRBadge(meses);
      updateTableHeadMeta(Math.max(1, Math.floor(meses)));
    }
  }

  return {
    title: "Poupança x Selic",
    mount(){
      // mostra a tabela (fica fora da view)
      document.getElementById("psTableSection")?.classList.remove("hidden");

      showView(viewId);

      // Submit / Export
      on($("#psForm"),     "submit", (e)=>{ e.preventDefault(); calcular(); });
      on($("#psCalcular"), "click",  (e)=>{ e.preventDefault(); calcular(); });
      on($("#psExport"),   "click",   exportCSV);

      // Inputs normais: preparam (não calculam)
      ["#psSelicAA","#psTR","#psPoupAA","#psInicial","#psAporte","#psPeriodo","#psUnidade"]
        .forEach(sel => on($(sel), "input", handleFieldChange));

      // Taxa Poupança: foco libera edição; dblclick volta ao automático
      const poup = $("#psPoupAA");
      if (poup){
        poup.disabled = false;
        poup.readOnly = true;
        poup.classList.add("locked");

        on(poup, "focus", ()=>{ if(poup.readOnly){ poup.readOnly=false; poup.classList.remove("locked"); } });

        on(poup, "dblclick", ()=>{
          if(!poup.readOnly){
            const before = parseFloat(String(poup.value).replace(',','.')) || 0;
            const selicAA = Number($("#psSelicAA").value||0);
            const trAA    = Number($("#psTR").value||0);
            const autoVal = +(taxaPoupAA(selicAA, trAA).toFixed(2));
            poup.readOnly = true;
            poup.classList.add("locked");
            poup.value = autoVal.toFixed(2);
            const changed = Math.abs(before - autoVal) > 1e-4;
            if (changed){ if (last) markDirty(); else resetView(); }
          }
        });
      }

      // IR toggle
      on($("#psIRAtivo"), "input", handleIRToggle);

      // Paginador
      on($("#psPrev"), "click", ()=>{ tableState.page--; renderTable(); });
      on($("#psNext"), "click", ()=>{ tableState.page++; renderTable(); });

      // Itens por página
      on($("#psPerPage"), "change", () => {
        const val = parseInt($("#psPerPage").value || "10", 10);
        tableState.perPage = Math.max(1, isFinite(val) ? val : 10);
        tableState.page = 1;
        renderTable();
        requestAnimationFrame(movePagerToBottom);
      });
      if ($("#psPerPage")) $("#psPerPage").value = String(tableState.perPage || 10);

      // Botão "Copiar resumo" (delegação)
      on($("#psTableSection"), "click", (e)=>{
        const btn = e.target.closest("#psCopySummary");
        if (!btn) return;
        const meses = Math.max(1, (last?.labels?.length || 1) - 1);
        navigator.clipboard?.writeText(headerSummaryText(meses))
          .then(()=> { btn.textContent = "Copiado!"; setTimeout(()=>btn.textContent="Copiar resumo", 1200); })
          .catch(()=> { btn.textContent = "Erro :("; setTimeout(()=>btn.textContent="Copiar resumo", 1200); });
      });

      // posiciona a paginação + cria cabeçalho já com metas iniciais
      requestAnimationFrame(() => {
        movePagerToBottom();
        ensureEnhancedHeader();
        const initPeriod = Number($("#psPeriodo").value||1);
        const initMeses  = ($("#psUnidade").value==="anos") ? initPeriod*12 : initPeriod;
        updateTableHeadMeta(Math.max(1, Math.floor(initMeses)));
      });

      // Estado inicial
      refreshPoupAA();
      resetView(false);
      const initPeriod = Number($("#psPeriodo").value||1);
      const initMeses  = ($("#psUnidade").value==="anos") ? initPeriod*12 : initPeriod;
      updateIRBadge(initMeses);
      // (updateTableHeadMeta já é chamado no rAF acima)
    },
    unmount(){
      if(chart){ chart.destroy(); chart=null; }
      offAll();
      last = null;
      dirty = false;

      // esconde a tabela ao sair desta calculadora
      document.getElementById("psTableSection")?.classList.add("hidden");
    }
  };
})());