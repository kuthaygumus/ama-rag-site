/**
 * Term popovers: a word the reader is allowed not to know. Pages mark it with
 * <Term id="chunk">chunk'lar</Term>; the definition lives here, written once.
 * One or two plain sentences, no second unexplained term inside. Longer explanations
 * belong on the Sözlük page. A marker with no entry here degrades to plain text.
 */
export const terms = {
  chunk: { title: 'Chunk', body: 'Bir dokümanın parçası. Arama tüm dokümanı değil, bu parçaları bulur; modele de yalnızca seçilen birkaç parça gider.' },
  embedding: { title: 'Embedding', body: 'Bir metnin sayı listesi (vektör) hâli. Anlamı yakın metinlerin sayıları da birbirine yakın çıkar.' },
  vektor: { title: 'Vektör', body: 'Sıralı bir sayı listesi. Bizim embedding modelimiz her metin için 1024 sayılık bir vektör üretir.' },
  cosine: { title: 'Cosine benzerliği', body: 'İki vektörün aynı yöne ne kadar baktığı: −1 ile 1 arasında, 1 = aynı yön (aynı anlam). Bizim modelde ilgisiz metinler bile 0’a inmez: ölçtüğümüz ilgisiz çift 0.456 aldı. Skor görelidir.' },
  topk: { title: 'Top-k', body: 'Aramanın döndürdüğü en yakın k parça; bizde k = 5. k küçükse doğru parça listeye giremeyebilir; büyüdükçe rerank daha çok parça puanlar ve süre uzar. Prompt’a yine en iyi 3 parça girer.' },
  rerank: { title: 'Rerank', body: 'Arama sonuçlarını ikinci, daha dikkatli bir modelle yeniden sıralamak. Soru ile parçayı birlikte okur.' },
  metadata: { title: 'Metadata', body: 'Bir parçanın içeriği dışındaki etiketleri: hangi doküman, hangi sürüm, kim okuyabilir. Aramada filtre olarak kullanılır.' },
  vectordb: { title: 'Vector DB', body: 'Vektörleri, metinleri ve metadata’yı saklayıp en yakın komşuları hızlı bulan veritabanı. Bizimki Chroma.' },
  hnsw: { title: 'HNSW', body: 'Vector DB’lerin sık kullandığı indeks: vektörleri komşuluk grafiğine bağlar, arama yalnızca yakın mahalleyi gezer.' },
  token: { title: 'Token', body: 'Modelin okuduğu ve yazdığı en küçük metin parçası; kabaca bir kelimenin bir kısmı. Maliyet ve sınırlar token ile ölçülür.' },
  context: { title: 'Context window', body: 'Modelin tek seferde okuyabileceği token sınırı. Prompt (kaynaklar dahil) ve cevap bu sınıra sığmak zorunda.' },
  abstain: { title: 'Abstain', body: 'Cevap kaynaklarda yoksa modelin bilerek “bilmiyorum” demesi. Kendiliğinden olmaz; tasarlanır.' },
  injection: { title: 'Prompt injection', body: 'Modelin okuduğu bir metnin içine talimat gizlemek. RAG’de bu metin bir doküman olabilir.' },
  finetune: { title: 'Fine-tuning', body: 'Hazır bir modeli kendi örneklerinizle biraz daha eğitmek; modelin ağırlıklarını değiştirir. Davranışı (ton, format, terim) iyi öğretir, olguları güvenilmez. Öğretileni değiştirmek yeniden eğitim ister.' },
  weights: { title: 'Ağırlıklar', body: 'Modelin eğitimde öğrendiği milyarlarca sayı. Model bildiğini burada tutar; eğitim bitince donarlar.' },
  pca: { title: 'PCA', body: '1024 boyutu çizilebilir 2 boyuta indirmek: parçaların en çok farklılaştığı iki yönü bulur. Bilginin çoğu kaybolur, kaba yerleşim kalır.' },
  mrr: { title: 'MRR', body: 'Her soru için 1 / (ilk doğru sonucun sırası), sonra bütün soruların ortalaması. 1.0 = doğru sonuç hep ilk sırada.' },
  hallucination: { title: 'Halüsinasyon', body: 'Modelin gerçekmiş gibi, kendinden emin bir şekilde uydurması.' },
  goldset: { title: 'Gold set', body: 'Cevabı önceden bilinen soru listesi: her soru için doğru bölüm ve beklenen değer. Sistemin her sürümü aynı listeyle puanlanır.' },
  hit1: { title: 'hit@1', body: 'İlk sonuç doğru mu? Doğruysa 1, değilse 0; bütün soruların ortalaması alınır.' },
  recallk: { title: 'recall@k', body: 'Doğru bölümlerin ne kadarının ilk k sonuca girdiği. Sıraya bakmaz; içeride olması yeter.' },
  judge: { title: 'LLM-as-judge', body: 'Bir cevabı başka bir dil modeline puanlatmak, örneğin “bu cevaptaki her iddia kaynaklarda var mı?”. Hakem de yanılabilir; onu da ölçmek gerekir.' },
  hybrid: { title: 'Hybrid arama', body: 'Kelime eşleşmesiyle yapılan aramayı vektör aramasıyla birleştirmek. Kod, numara, ad gibi birebir aranan kelimelerde işe yarar.' },
  hyde: { title: 'HyDE', body: 'Önce modele soruya varsayımsal bir cevap yazdırıp aramayı soruyla değil bu cevapla yapmak. Varsayımsal cevap dokümanın diline sorudan daha yakındır.' },
  parentchild: { title: 'Parent-child', body: 'Küçük parçalarla arayıp bulunan parçanın ait olduğu büyük parçayı modele vermek. Küçük parça iyi bulunur, büyük parça iyi okunur.' },
  agentic: { title: 'Agentic RAG', body: 'Aramayı modelin yönettiği RAG: soruyu böler, her parça için arar, yeterli bilgi toplanana kadar tekrarlar. Daha çok çağrı, daha çok süre.' },
  graphrag: { title: 'GraphRAG', body: 'Dokümanlardaki varlıkları ve aralarındaki ilişkileri bir grafa çıkarıp soru anında bu bağları izlemek. Cevabı dokümanlar arasındaki bağda olan sorular için.' },
  multiquery: { title: 'Multi-query', body: 'Model bir soruyu birkaç farklı biçimde yeniden yazar; her biriyle ayrı arama yapılır, sonuçlar birleştirilir.' },
  ragfusion: { title: 'RAG-fusion', body: 'Multi-query gibi çalışır, ama sonuç listelerini sıralarına göre puanlayarak birleştirir: birkaç listede üstte çıkan parça öne geçer.' },
  pii: { title: 'Kişisel veri (PII)', body: 'Bir kişiyi tanımlayan bilgi: ad, sicil numarası, telefon, e-posta. Doküman sisteme girerken, vektöre çevrilmeden önce maskelenmeli.' },
  rag: { title: 'RAG', body: 'Retrieval-Augmented Generation: soruyu cevaplamadan önce ilgili doküman parçalarını bulup modelin önüne koymak. Model değişmez; değişen, modele verilen girdidir.' },
  ingest: { title: 'Ingest', body: 'Dokümanları aranabilir hâle getiren hazırlık: yükle, temizle, parçala, vektöre çevir, sakla. Bir kere çalışır; doküman değişince yeniden.' },
  prompt: { title: 'Prompt', body: 'Modele giden metnin tamamı. RAG’de kurallar, numaralı kaynaklar ve sorudan oluşur; model bunun dışında hiçbir şey görmez.' },
  bruteforce: { title: 'Brute force', body: 'Soruyu depodaki her vektörle tek tek karşılaştırmak. Sonuç kesindir, ama iş vektör sayısıyla birlikte büyür.' },
  ann: { title: 'ANN', body: 'Approximate nearest neighbor: en yakın vektörleri her şeye bakmadan, bir indeksin içinde komşudan komşuya atlayarak bulmak. Çok hızlıdır; en yakını büyük olasılıkla bulur ama garanti etmez.' },
  mmr: { title: 'MMR', body: 'Maximal Marginal Relevance: sonuçları seçerken hem soruya yakınlığa hem de zaten seçilenlerden farklılığa bakmak. Birbirinin kopyası parçalar yerine çeşitli parçalar gelir.' },
};

export const termPopoverScript = `
(function () {
  var DEFS = __TERM_DEFS__;
  var CLOSE_DELAY = 140;
    var card = null;
  var current = null;
  var closeTimer = null;
  // With a mouse the card is already open by the time a click lands, so a click must not
  // toggle it shut. On a touch screen the tap is the only way in, so there it toggles.
  var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;

  function def(id) {
    var entry = DEFS[id];
    if (!entry) return null;
    return entry;
  }

  function ensureCard() {
    if (card) return card;
    card = document.createElement('div');
    card.className = 'term-popover';
    card.setAttribute('role', 'tooltip');
    card.hidden = true;
    // Keeping the pointer inside the card keeps it open, so a long definition can be
    // read at leisure and selected.
    card.addEventListener('mouseenter', function () { clearTimeout(closeTimer); });
    card.addEventListener('mouseleave', scheduleClose);
    document.body.appendChild(card);
    return card;
  }

  function place(el) {
    var rect = el.getBoundingClientRect();
    var margin = 10;
    card.style.left = '0px';
    card.style.top = '0px';
    var box = card.getBoundingClientRect();
    var left = rect.left + rect.width / 2 - box.width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - box.width - margin));
    var below = rect.bottom + 8;
    var top = below + box.height + margin > window.innerHeight && rect.top - 8 - box.height > margin
      ? rect.top - 8 - box.height
      : below;
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
  }

  function open(el) {
    var entry = def(el.dataset.term);
    if (!entry) return;
    clearTimeout(closeTimer);
    ensureCard();
    card.innerHTML = '';
    var h = document.createElement('strong');
    h.textContent = entry.title;
    var p = document.createElement('p');
    p.textContent = entry.body;
    card.appendChild(h);
    card.appendChild(p);
    card.hidden = false;
    card.id = card.id || 'term-popover';
    if (current && current !== el) current.removeAttribute('aria-describedby');
    current = el;
    el.setAttribute('aria-describedby', card.id);
    el.dataset.termOpen = 'true';
    place(el);
  }

  function close() {
    if (!card || card.hidden) return;
    card.hidden = true;
    if (current) {
      current.removeAttribute('aria-describedby');
      delete current.dataset.termOpen;
      current = null;
    }
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(close, CLOSE_DELAY);
  }

  function wire(el) {
    if (!def(el.dataset.term)) {
      // No definition: drop the affordance rather than promise a popover that is empty.
      el.classList.remove('term');
      return;
    }
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('mouseenter', function () { open(el); });
    el.addEventListener('mouseleave', scheduleClose);
    el.addEventListener('focus', function () { open(el); });
    el.addEventListener('blur', close);
    // Tap on a touch screen, and Enter/Space once focused.
    el.addEventListener('click', function (event) {
      event.preventDefault();
      if (!canHover && current === el && card && !card.hidden) close();
      else open(el);
    });
    el.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      el.click();
    });
  }

  function scan() {
    document.querySelectorAll('.term[data-term]').forEach(function (el) {
      if (el.dataset.termWired) return;
      el.dataset.termWired = '1';
      wire(el);
    });
  }

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close();
  });
  // Repositioning a card mid-scroll fights the reader; dismissing it does not.
  window.addEventListener('scroll', close, { passive: true });
  window.addEventListener('resize', close);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
`.trim();
