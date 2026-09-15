// 写し: 正典は ~/Takeshi_Automation/site/js/page-doc-engine.js。直接直さない（食い違うと正典側 tests/sharoushi/test_page_doc.mjs が落ちる・2026-09-15）。
/*
 * page-doc-engine.js — 主力2記事の「対価」本文を組む純関数（ブラウザ / Netlify Function 共用）
 *
 * 正典: .company/products/SHUGYOKISOKU_AI_PRODUCT_DEFINITION_v3_2026-09-01.md §10
 *   §10.1 規定例ガイド: ブロックA 結論（3行以内）／B 足す条文（1本）／C 逆算カレンダー（固定日）
 *   §10.2 基本方針ガイド: 選んだ1場面だけ（言葉 2〜4文／交代の基準 1文／「全場面はパック」1文）
 *
 * なぜ分離したか:
 *   メールで渡す本文（§10.3）を、クライアントから受け取らない。send-result-mail.js は
 *   「件名と本文はサーバ側で決める」設計（任意の本文を他人宛に撃てる中継にしない）なので、
 *   画面と同じ本文をサーバでも組めるよう、組み立てを1箇所の純関数にした。
 *   ブラウザは <script src="/js/page-doc-engine.js"> で window.PageDocEngine、
 *   Function は require('../../site/js/page-doc-engine.js') で同じものを使う。
 *
 * 文言は正典の引用ブロックを一字一句使う（§0.1「意訳しない」）。ここに無い文は増やさない。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PageDocEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENFORCE_LABEL = '2026年10月1日';

  // ── 入力の許可値（§7.1 / §7.2）。ここに無い値は build が null を返す。 ──────────
  // 値は 8/31 実装を踏襲（計測 props の連続性のため改名しない・正典 §7.1）。
  var LABELS = {
    kitei: {
      size:  { lt10: '10人未満', ge10: '10人以上' },
      union: { yes: 'ある', no: 'ない' },
      rules: { have: 'すでにある（今回は追記・改定）', none: 'まだない（新規）' }
    },
    hoshin: {
      biz:   { food: '飲食', retail: '小売', care: '介護', const_: '建設', other: 'その他' },
      scene: {
        shout:   '店頭・窓口で大声',
        repeat:  '同じ要求の繰り返し',
        phone:   '時間外の執拗な連絡',
        apology: '土下座・SNSでの晒し',
        vendor:  '取引先からの過大要求'
      }
    }
  };

  // ── ブロックB: 足す条文。記事本文 kasuhara-shugyokisoku-kitei-guide.html の .tpl と
  //    一字一句同じであること（tests/sharoushi/test_page_doc.mjs が機械で照合する）。 ──
  var CLAUSE_APPEND_TITLE = '第◯条（顧客等からの著しい迷惑行為への対応）';
  var CLAUSE_APPEND = [
    '1. 会社は、顧客、取引先その他の関係者（以下「顧客等」という）の言動であって、社会通念上許容される範囲を超え、従業員の就業環境を害するもの（以下「カスタマーハラスメント」という）から、従業員を保護するため、必要な措置を講ずる。',
    '2. 従業員は、業務中にカスタマーハラスメントを受けた場合、速やかに所属長または相談窓口に報告するものとする。',
    '3. 会社は、前項の報告を受けたときは、事実関係を確認のうえ、従業員を一人で対応させない、必要に応じて対応者を交代させる、犯罪に該当し得る言動については警察への通報を検討するなど、状況に応じた措置を講ずる。',
    '4. 会社は、相談したこと又は事実確認に協力したことを理由として、当該従業員に対し解雇その他不利益な取扱いを行わない。'
  ];
  var CLAUSE_DELEGATE_TITLE = '委任条文の例';
  var CLAUSE_DELEGATE =
    '顧客等からの著しい迷惑行為（カスタマーハラスメント）への対応に関する具体的な相談窓口、対応手順その他必要な事項は、別に定めるハラスメント防止規程による。';

  // 条文の末尾に必ず付ける1文（§10.1）
  var CLAUSE_TAIL = 'この文は一般的な記載例です。届出前に、顧問がいる場合は顧問へ渡してください。';

  // カレンダーの注記（§10.1）
  var CAL_NOTE = '日付は余裕を見た目安です。届出の法定期限がこの日だと述べているものではありません。';
  // 施行日を過ぎたあとの注記（逆算の目安日はもう意味を持たないので、同じ文は使わない）
  var CAL_NOTE_AFTER = '上の並びは実務上の順番です。届出の法定期限を述べているものではありません。';
  // 予定日を過ぎた前提作業が並びに残っているときだけ足す1文（急かす文にしない）
  var CAL_NOTE_OVERDUE = '予定日を過ぎた項目は、まだであればここから始めます。';
  // 予定日を過ぎた項目に添える印（残り日数の代わり。まだ間に合うかのように書かない）
  var OVERDUE_MARK = '（予定日を過ぎています）';

  var LINE = '――――――――――――――――――――――――――';

  // ── §10.1 ブロックA 結論（3行以内・正典の例文をそのまま使う） ─────────────────
  function conclusion(v) {
    var big = v.size === 'ge10', union = v.union === 'yes', isNew = v.rules === 'none';
    if (!big && isNew) {
      // lt10 / * / new
      return [
        '従業員10人未満のため、新規作成しても労基署への届出は不要です。',
        '作成する規則には、カスハラの方針・窓口・対処の内容を入れて周知します。'
      ];
    }
    if (!big) {
      // lt10 / yes|no / have
      return union
        ? ['従業員10人未満のため、労基署への就業規則変更届は不要です。',
           '過半数組合があるため、改定するなら組合への意見聴取から始めます。']
        : ['従業員10人未満のため、労基署への就業規則変更届は不要です。',
           '過半数組合がないため、改定するなら過半数代表の選出から始めます。',
           '会社が代表者を指名すると、あとから手続が無効になることがあります。'];
    }
    // ge10
    var after = isNew ? '作成後' : '改定後';
    return union
      ? ['従業員10人以上のため、' + after + 'は所轄労基署への届出が必要です。',
         '過半数組合があるため、組合への意見聴取から始めます。']
      : ['従業員10人以上のため、' + after + 'は所轄労基署への届出が必要です。',
         '過半数組合がないため、先に過半数代表を選出します。',
         '会社が代表者を指名すると、届出が受け付けられないことがあります。'];
  }

  // ── §10.1 ブロックB 足す条文（条件で1本だけ） ─────────────────────────────
  //   have            → 追記型（既存のハラスメント条の次に足す）
  //   new かつ lt10   → 記事にある条文をそのまま新規則へ入れる（正典が言う「簡易型」は
  //                     記事本文に存在しないため、追記型と同じ1本を出す。増やさない）
  //   new かつ gte10  → 独立規程型の骨子＝本則に委任条文、詳細は別規程
  function clause(v) {
    var L = [];
    var isNew = v.rules === 'none', big = v.size === 'ge10';
    if (isNew && big) {
      L.push('■ 足す条文（独立規程型の骨子）');
      L.push('本則に次の委任条文を置き、窓口・手順は別規程にまとめます。');
      L.push('');
      L.push(CLAUSE_DELEGATE_TITLE);
      L.push(CLAUSE_DELEGATE);
      L.push('');
      L.push('別規程の中核（' + CLAUSE_APPEND_TITLE + '）');
    } else if (isNew) {
      L.push('■ 足す条文（新しく作る規則に入れる1本）');
      L.push(CLAUSE_APPEND_TITLE);
    } else {
      L.push('■ 足す条文（既存のハラスメント条の次に足す1本）');
      L.push(CLAUSE_APPEND_TITLE);
    }
    for (var i = 0; i < CLAUSE_APPEND.length; i++) L.push(CLAUSE_APPEND[i]);
    L.push('');
    L.push(CLAUSE_TAIL);
    return L;
  }

  // ── §10.1 ブロックC 逆算カレンダー（施行日から戻す） ─────────────────────────
  //   2026-09-05 修理: ここは静的配列を slice して返すだけで、今日を一度も見ていなかった。
  //   今日を注入できる形にして、(1) 過ぎた項目を落とす (2) 残り日数を添える
  //   (3) 全部落ちたら番号つきの順番だけ (4) 施行日を過ぎたら文面ごと切り替える。
  //
  //   2026-09-07 修理: (1) が行き過ぎていた。DEADLINES を1種類として扱ったため、
  //   前提作業型（過半数代表の選出公示）まで予定日の翌日に落ちていた。結論は
  //   「先に過半数代表を選出します」と言い続けているのに、その行だけが並びから消える。
  //   09-06 から施行日まで毎日効いていた（画面・メール本文・.docx 添付の3面すべて）。
  //   → 落とすのは期日型だけにし、前提作業型は過ぎても先頭に残す（kind を見る）。
  function calendar(v, today) {
    var t = ymd(today);
    var L = [];
    var all = DEADLINES[v.size === 'ge10' ? 'ge10' : 'lt10'];

    // (4) 施行後: 期限に間に合わせる話ではなくなる。義務は続くので着手を促す。
    if (t > ENFORCE_DATE) {
      L.push('■ 措置義務はすでに始まっています（' + ENFORCE_DATE + ' 施行・' + daysBetween(ENFORCE_DATE, t) + '日経過）');
      L.push('未対応であれば、期日を待つ段階ではありません。次の順番でいますぐ着手してください。');
      for (var a = 0; a < all.length; a++) L.push((a + 1) + '. ' + all[a].label);
      L.push('');
      L.push(CAL_NOTE_AFTER);
      return L;
    }

    var list = upcoming(v, t, true);
    var toEnforce = daysBetween(t, ENFORCE_DATE);
    var ahead = 0, overdue = 0;
    for (var c = 0; c < list.length; c++) list[c].overdue ? overdue++ : ahead++;

    // (3) まだ先の目安日が1つも無い（＝逆算する相手がいない）。施行日は今日か、まだ先。
    //     残っている前提作業もここで番号つきの順番に含めて出す（並びから消さない）。
    if (!ahead) {
      L.push(toEnforce === 0
        ? '■ 本日（' + ENFORCE_DATE + '）から措置義務が始まります'
        : '■ 施行日（' + ENFORCE_DATE + '）まで あと' + toEnforce + '日');
      L.push('逆算の目安日はすべて過ぎています。未対応であれば、次の順番でいますぐ着手してください。');
      for (var b = 0; b < all.length; b++) L.push((b + 1) + '. ' + all[b].label);
      L.push('');
      L.push(CAL_NOTE_AFTER);
      return L;
    }

    L.push('■ ' + ENFORCE_LABEL + 'までの順番（施行日まで あと' + toEnforce + '日）');
    for (var i = 0; i < list.length; i++) {
      L.push('〜' + list[i].date + leftLabel(list[i]) + '  ' + list[i].label);
    }
    L.push(ENFORCE_DATE + '  措置義務の開始');
    L.push('');
    if (overdue) L.push(CAL_NOTE_OVERDUE);
    L.push(CAL_NOTE);
    return L;
  }

  function buildKitei(v, today) {
    var L = [];
    var afterEnforce = ymd(today) > ENFORCE_DATE;
    L.push('御社の場合に足す条文と、' + (afterEnforce ? 'いま着手する順番' : ENFORCE_LABEL + 'までの順番'));
    L.push('条件: 従業員 ' + LABELS.kitei.size[v.size] + '／過半数組合 ' + LABELS.kitei.union[v.union] +
           '／就業規則 ' + LABELS.kitei.rules[v.rules]);
    L.push('');
    L.push('■ 結論');
    L = L.concat(conclusion(v));
    L.push('');
    L = L.concat(clause(v));
    L.push('');
    L = L.concat(calendar(v, today));
    L.push('');
    L.push(LINE);
    L.push('一般的な情報提供と書類の下書きです。不足の断定ではありません。');
    return L.join('\n');
  }

  // ── §10.2 基本方針ガイド: 選んだ1場面の現場の言葉 ─────────────────────────
  var BIZ = {
    food:   { who: 'ホールの担当者', place: '客席' },
    retail: { who: 'レジ・売場の担当者', place: '売場' },
    care:   { who: '介護職員', place: '居室・事業所' },
    const_: { who: '現場の担当者', place: '現場' },
    other:  { who: '担当者', place: '応対の場' }
  };
  var SCENES = {
    shout: {
      words: [
        '「大きな声でのお話は他のお客様のご迷惑になりますので、お声を落としていただけますか。」',
        '「その言い方が続くようでしたら、本日のご対応はここまでとさせていただきます。」',
        '「担当を代わります。少々お待ちください。」'
      ],
      handoff: '身の危険を感じる段階では対応を続けず、別の者を呼んで交代し、退避と通報を優先します。'
    },
    repeat: {
      words: [
        '「前回と同じご回答になりますが、当社の対応は◯◯です。」',
        '「同じご用件でのご来店は、これ以上のご対応をいたしかねます。」',
        '「次回以降のご用件は、責任者の◯◯が承ります。」'
      ],
      handoff: '来訪の日時と要求内容を毎回残し、同じ要求が3回目になった時点で責任者へ交代します。'
    },
    phone: {
      words: [
        '「お客様のお話は承りました。いただいたご意見は記録して社内で共有いたします。」',
        '「営業時間外のご連絡には対応いたしかねます。営業時間内にあらためてお願いいたします。」',
        '「私では判断いたしかねますので、責任者の◯◯からご連絡いたします。お名前とご連絡先をお願いできますでしょうか。」'
      ],
      handoff: '会社として切ってよい時間の上限（例: 30分）を決めておき、超えたら責任者へ交代します。'
    },
    apology: {
      words: [
        '「ご迷惑をおかけした点についてはお詫びいたします。」',
        '「それ以上のご要望にはお応えいたしかねます。」',
        '「ご意見として承ります。対応の内容は変わりません。」'
      ],
      handoff: '土下座の要求や「SNSに書く」と言われた時点で、担当者は対応を続けず責任者へ交代します。'
    },
    vendor: {
      words: [
        '「ご要望は承りました。契約の範囲を超える内容は、社内で確認のうえ回答いたします。」',
        '「この場でお約束することはできかねます。書面でいただけますでしょうか。」',
        '「担当の◯◯から、あらためてご連絡いたします。」'
      ],
      handoff: '契約外の要求や担当者個人への圧力が出た時点で、担当者は回答せず責任者へ交代します。'
    }
  };

  function buildHoshin(v) {
    var b = BIZ[v.biz], s = SCENES[v.scene];
    var L = [];
    L.push('この場面で現場が使う言葉 — ' + LABELS.hoshin.biz[v.biz] + '／' + LABELS.hoshin.scene[v.scene]);
    L.push('');
    L.push('■ ' + b.who + 'がその場で使ってよい言葉');
    for (var i = 0; i < s.words.length; i++) L.push('　' + s.words[i]);
    L.push('');
    L.push('■ 管理者が交代する基準');
    L.push('　' + s.handoff);
    L.push('');
    L.push('全場面の想定問答は実務パックにあります。');
    L.push('');
    L.push(LINE);
    L.push('「◯◯」は自社の責任者名・部署名に置き換えてください。一般的な情報提供と書類の下書きです。不足の断定ではありません。');
    return L.join('\n');
  }

  // ── 期日の構造化（リマインド送信用・§10.1 ブロックC と同じ日付。文言はCと同じ語） ──
  //   2026-09-04 執行部発注: 引き換えを「その会社の期日に同じ内容をもう一度届ける」へ。
  //   ここが唯一の期日の正典。C の文面とずれないよう、C もこの配列から描く。
  var YEAR = '2026';
  var ENFORCE_DATE = YEAR + '-10-01';
  //
  // kind は2種類ある（2026-09-07 追加）。1種類として扱うと、過ぎた前提作業が黙って消える。
  //   'deadline'     … 期日型。過ぎたら意味が変わる（もう間に合わない）。過ぎたら出さない
  //   'prerequisite' … 前提作業型。後ろの項目が成り立つための前提で、**過ぎても依然として必要**。
  //                    過ぎても並びの先頭に残し、予定日を過ぎたことが分かる形で出す
  var DEADLINES = {
    ge10: [
      { date: YEAR + '-09-05', kind: 'prerequisite', label: '過半数代表の選出公示（組合がない場合）／組合への意見聴取の依頼' },
      { date: YEAR + '-09-12', kind: 'deadline', label: '意見書を受け取る' },
      { date: YEAR + '-09-20', kind: 'deadline', label: '所轄労基署へ届出' },
      { date: YEAR + '-09-30', kind: 'deadline', label: '周知を完了する（掲示・交付・イントラ等）' }
    ],
    lt10: [
      { date: YEAR + '-09-20', kind: 'prerequisite', label: '方針と窓口担当を決める' },
      { date: YEAR + '-09-25', kind: 'deadline', label: '規則または方針文を更新する（届出は不要）' },
      { date: YEAR + '-09-30', kind: 'deadline', label: '従業員へ周知する' }
    ]
  };
  // ── 今日の扱い ────────────────────────────────────────────────────────────
  //   today は Date でも 'YYYY-MM-DD' 文字列でも渡せる。省略時は実行時の今日。
  //   引数で注入できるようにしたのは、システム日付に依存せず 9/6・9/21・10/2 のような
  //   時点を機械で検証できるようにするため（2026-09-05 修理の検証条件）。
  function ymd(today) {
    if (today == null) today = new Date();
    if (typeof today === 'string') return today.slice(0, 10);
    var y = today.getFullYear(), m = today.getMonth() + 1, d = today.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (d < 10 ? '0' : '') + d;
  }
  function toUTC(s) {
    var p = String(s).split('-');
    return Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  }
  /** from から to までの日数（同日なら 0・to が過去なら負）。時差・DST の影響を受けない。 */
  function daysBetween(from, to) {
    return Math.round((toUTC(to) - toUTC(from)) / 86400000);
  }
  function leftLabel(item) {
    if (item.overdue) return OVERDUE_MARK;
    return item.daysLeft === 0 ? '（本日）' : '（あと' + item.daysLeft + '日）';
  }
  /**
   * today 時点で並びに載せる項目を返す。
   *   forDisplay=false（既定・リマインドの予約用）… today 以降の項目だけ。過去日には送れない。
   *   forDisplay=true（画面・メール本文の並び用）  … 上に加えて、予定日を過ぎた
   *     **前提作業型**（kind:'prerequisite'）を先頭に残す。過ぎても依然として必要だから。
   *     過ぎた期日型は forDisplay でも落とす（過ぎたら意味が変わる）。
   */
  function upcoming(v, t, forDisplay) {
    var list = DEADLINES[v.size === 'ge10' ? 'ge10' : 'lt10'];
    var past = [], ahead = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var isPast = it.date < t;
      var row = {
        date: it.date, label: it.label, kind: it.kind,
        daysLeft: daysBetween(t, it.date), overdue: isPast
      };
      if (!isPast) { ahead.push(row); continue; }
      if (forDisplay && it.kind === 'prerequisite') past.push(row);
    }
    return past.concat(ahead); // 過ぎた前提作業は先頭（読む人は上から順にやる）
  }

  /**
   * kitei の条件から、**リマインドを送る日**の一覧（日付順・過ぎたものは含まない）。
   * hoshin は期日を持たない → []。施行日を過ぎていれば全件落ちて [] になる
   * （send-result-mail はこれを見てリマインド登録をしない = 送りっぱなしにならない）。
   *
   * ここは「いつ送るか」であって「並びに何を出すか」ではない。2026-09-07 に
   * 前提作業型を並びへ残す修理を入れたが、それはあくまで表示（calendar）の話で、
   * ここへ過去日を混ぜてはいけない。混ぜると send-result-mail の本文が
   * 「その日にもう一度お届けします」と、もう来ない日を約束する。
   */
  function deadlines(kind, v, today) {
    if (kind !== 'kitei' || !valid(kind, v)) return [];
    return upcoming(v, ymd(today), false);
  }

  function valid(kind, v) {
    var spec = LABELS[kind];
    if (!spec || !v) return false;
    for (var k in spec) {
      if (!Object.prototype.hasOwnProperty.call(spec, k)) continue;
      if (!v[k] || !Object.prototype.hasOwnProperty.call(spec[k], v[k])) return false;
    }
    return true;
  }

  /** kind: 'kitei' | 'hoshin'。値が許可外なら null。today を省略すると実行時の今日。 */
  function build(kind, v, today) {
    if (!valid(kind, v)) return null;
    return kind === 'kitei' ? buildKitei(v, today) : buildHoshin(v);
  }

  /*
   * 届出に使う書類（kitei のメール1つとの交換物・2026-09-15 ディストリビューション戦略発注 WO「記事2本の引き換え物を直す」）
   *
   * 渡す書類は**3問の答えで決める**。画面の結論（buildKitei）と食い違う書類は渡さない:
   *   - 就業規則（変更）届 … 10人以上だけ（10人未満は「届出は不要」と画面が言っている）
   *   - 過半数代表者の選出記録 … 過半数組合が無いときだけ（組合があれば組合が意見を述べる）
   *   - 意見書 … 全員（組合があれば組合名義、無ければ過半数代表者名義）
   *
   * 書式と項目は一次出典で確かめたものだけ。断定できない欄（日付・番号・名称・人数）は空欄で残す。
   *   - 意見書: 東京労働局「意見書」様式 https://jsite.mhlw.go.jp/tokyo-roudoukyoku/content/contents/001136380.pdf
   *   - 就業規則（変更）届: 神奈川労働局「就業規則（変更）届」記載例 https://jsite.mhlw.go.jp/kanagawa-roudoukyoku/content/contents/shuki_todoke_rei.doc
   *   - 過半数代表者の要件: 労働基準法施行規則 第6条の2（e-Gov 法令検索）。選出記録に国の定めた様式は無いので、
   *     条文の要件をそのまま確認欄にしている（様式ではないことを本文に書く）
   *
   * 出力は _docx.js が読むプレーンテキスト: 「# 」で始まる行＝見出し1、「\f」だけの行＝改ページ。
   */
  var FORM_TITLES = { senshutsu: '過半数代表者の選出記録', iken: '意見書', todoke: '就業規則変更届', todoke_new: '就業規則届' };

  function forms(kind, v) {
    if (kind !== 'kitei' || !valid(kind, v)) return [];
    var out = [];
    if (v.union === 'no') out.push({ id: 'senshutsu', title: FORM_TITLES.senshutsu });
    out.push({ id: 'iken', title: FORM_TITLES.iken });
    if (v.size === 'ge10') out.push({ id: 'todoke', title: v.rules === 'none' ? FORM_TITLES.todoke_new : FORM_TITLES.todoke });
    return out;
  }

  function buildForms(v) {
    var list = forms('kitei', v);
    if (!list.length) return null;
    var make = v.rules === 'none' ? '作成' : '変更';
    var pages = [];
    list.forEach(function (f) {
      var L = [];
      if (f.id === 'senshutsu') {
        L.push('# ' + FORM_TITLES.senshutsu);
        L.push('（就業規則の' + make + 'について意見を述べる者の選出）');
        L.push('');
        L.push('この用紙は国の定めた様式ではありません。労働基準法施行規則第6条の2が求める要件を、記録として残す欄に並べたものです。');
        L.push('');
        L.push('■ 選出の目的');
        L.push('就業規則の' + make + 'について、労働基準法第90条第1項の意見を述べる「労働者の過半数を代表する者」を選出するため');
        L.push('');
        L.push('■ 実施した日　　　　年　　月　　日');
        L.push('■ 選出の方法（該当に○）　投票 ・ 挙手 ・ 話し合い ・ 持ち回り');
        L.push('■ 手続に参加した労働者　　　　人（正社員・パート・アルバイト等を含む事業場の労働者）');
        L.push('■ 結果　　賛成　　　　人 ／ 参加　　　　人');
        L.push('■ 選出された者　職名　　　　　　　　　氏名　　　　　　　　　');
        L.push('');
        L.push('■ 確認（労働基準法施行規則 第6条の2）');
        L.push('□ 選出された者は、労働基準法第41条第2号に規定する監督又は管理の地位にある者ではない');
        L.push('□ 意見を述べる者を選出することを明らかにしたうえで、投票・挙手等の方法による手続で選出した');
        L.push('□ 使用者の意向に基づいて選出された者ではない');
        L.push('');
        L.push('記録した者　職名　　　　　　　　　氏名　　　　　　　　　');
      } else if (f.id === 'iken') {
        L.push('# ' + FORM_TITLES.iken);
        L.push('　　　　年　　月　　日');
        L.push('');
        L.push('　　　　　　　　　　　　　　　　殿');
        L.push('');
        L.push('令和　　年　　月　　日付をもって意見を求められた就業規則案について、下記のとおり意見を提出します。');
        L.push('');
        L.push('記');
        L.push('');
        L.push('（意見）');
        L.push('');
        L.push('');
        if (v.union === 'yes') {
          L.push('労働組合の名称　　　　　　　　　　　　　　　　');
          L.push('職名　　　　　　　　　氏名　　　　　　　　　');
        } else {
          L.push('職名　　　　　　　　　');
          L.push('労働者の過半数を代表する者の氏名　　　　　　　　　');
          L.push('労働者の過半数を代表する者の選出方法（　　　　　　　　　　）');
        }
        L.push('');
        L.push('出典: 東京労働局「意見書」様式の項目どおり');
      } else {
        L.push('# ' + f.title);
        L.push('　　　　年　　月　　日');
        L.push('');
        L.push('　　　　　　　労働基準監督署長　殿');
        L.push('');
        L.push('今回、別添のとおり当社の就業規則を' + (v.rules === 'none' ? '制定' : '変更') + 'いたしましたので、意見書を添えて提出します。');
        L.push('');
        if (v.rules !== 'none') {
          L.push('■ 主な変更事項');
          L.push('条文　第　　条');
          L.push('改正前　（規定なし）');
          L.push('改正後　顧客等からの著しい迷惑行為への対応に関する規定を新設');
          L.push('');
        }
        L.push('■ 労働保険番号　　　　　　　　　　　　　　　　');
        L.push('■ 事業場名　　　　　　　　　　　　　　　　');
        L.push('■ 所在地　　　　　　　　　　　　　　　　　　電話　　　　　　　　');
        L.push('■ 使用者職氏名　　　　　　　　　　　　　　　　');
        L.push('■ 業種・労働者数　業種　　　　　　　　　企業全体　　　　人 ／ 事業場のみ　　　　人');
        L.push('');
        L.push('出典: 神奈川労働局「就業規則（変更）届」記載例の項目どおり');
      }
      pages.push(L.join('\n'));
    });
    return pages.join('\n\f\n');
  }

  // メール件名（サーバ側で決める・§10.3）
  var SUBJECT = {
    kitei: '【就業規則AI】足す条文と、届出までの順番',
    hoshin: '【就業規則AI】この場面で現場が使う言葉'
  };

  return {
    build: build,
    forms: forms,
    buildForms: buildForms,
    valid: valid,
    deadlines: deadlines,
    ENFORCE_DATE: ENFORCE_DATE,
    DEADLINES: DEADLINES,
    LABELS: LABELS,
    SUBJECT: SUBJECT,
    CLAUSE_APPEND: CLAUSE_APPEND,
    CLAUSE_APPEND_TITLE: CLAUSE_APPEND_TITLE,
    CLAUSE_DELEGATE: CLAUSE_DELEGATE,
    CLAUSE_TAIL: CLAUSE_TAIL
  };
});
