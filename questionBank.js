// questionBank.js — N7–N9 question bank + rendering + marking (static prototype)

// Extracted/adapted from the provided N7–N9 generator file.


/* ============================================================
   GCSE (Foundation) Number Question Preview Tool (N1–N50)
   - NO ratio topics.
   - NO recurring decimals.
   - Finer-grained topics (each N code is a single narrow topic).
   - Marks selector gives a question that is worth those marks:
       higher marks => more steps / more answer boxes / more structure,
       not just “same question with bigger numbers”.
   - Calculator mode uses calculator-suitable numbers (messier decimals, awkward divisions),
     and where needed asks for answers to 2 decimal places.
   ============================================================ */

// SECTION: File map (searchable)
// - SECTION: Seeded RNG
// - SECTION: Formatting helpers (MathML, standard form parsing)
// - SECTION: Topic list / navigation (TOPICS)
// - SECTION: Scenario variants (contextVariants)
// - SECTION: Question parts (partInteger/partNumber/...)
// - SECTION: Build question card (buildQuestion switch by topic code)
// - SECTION: Rendering + interaction (tabs, check/reveal, drag ordering)
// EDIT HERE: Most question content is generated in buildQuestion(topicCode, marksTotal, rng).

// SECTION: Seeded RNG (deterministic per regeneration seed)
function hashToUint32(str){
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function cryptoSeed(){
  if (window.crypto && crypto.getRandomValues){
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] >>> 0;
  }
  return (Math.random()*2**32)>>>0;
}
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedLike){
  const seed = (seedLike===undefined || seedLike===null || seedLike==="")
    ? cryptoSeed()
    : (typeof seedLike==="number" ? (seedLike>>>0) : hashToUint32(String(seedLike)));
  const r = mulberry32(seed);
  return {
    seed,
    float: ()=>r(),
    int: (min,max)=>{
      min=Math.ceil(min); max=Math.floor(max);
      return Math.floor(r()*(max-min+1))+min;
    },
    choice: (arr)=>arr[Math.floor(r()*arr.length)],
    shuffle: (arr)=>{
      const a=arr.slice();
      for(let i=a.length-1;i>0;i--){
        const j=Math.floor(r()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    }
  };
}

/* -------------------- helpers -------------------- */
function gcd(a,b){a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b]}return a||1}
function lcm(a,b){ return Math.abs(a*b)/gcd(a,b); }
function roundTo(x, dp){
  const f = 10**dp;
  return Math.round((+x + Number.EPSILON)*f)/f;
}
function fmt(x, maxDp=6){
  const n = Number(x);
  if(!Number.isFinite(n)) return String(x);
  const s = n.toFixed(maxDp);
  return s.replace(/\.?0+$/,"");
}

// Keep a fixed number of decimal places, but drop trailing ".00".
// Example: fmtNo00(100,2) -> "100"; fmtNo00(3.5,2) -> "3.50".
function fmtNo00(x, dp=2){
  const n = Number(x);
  if(!Number.isFinite(n)) return String(x);
  const s = n.toFixed(dp);
  return s.replace(/\.00$/,'');
}

// Format with a fixed number of decimal places.
function fmtDp(x, dp=2){
  const n = Number(x);
  if(!Number.isFinite(n)) return String(x);
  return n.toFixed(dp);
}

function simpFrac(n,d){
  if(d===0) return {n:NaN,d:NaN};
  if(d<0){n=-n;d=-d}
  const g=gcd(n,d);
  return {n:n/g,d:d/g};
}
function fracEq(a,b){
  const x=simpFrac(a.n,a.d), y=simpFrac(b.n,b.d);
  return x.n===y.n && x.d===y.d;
}
function asNum(v){
  const s = String(v??"").trim().replace(/,/g,"");
  if(!s) return NaN;
  // allow fraction "a/b" in numeric fields
  if(s.includes("/")){
    const m = s.match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
    if(!m) return NaN;
    const n=Number(m[1]), d=Number(m[2]);
    if(!Number.isFinite(n)||!Number.isFinite(d)||d===0) return NaN;
    return n/d;
  }
  // allow leading +, decimals
  const x = Number(s);
  return Number.isFinite(x) ? x : NaN;
}
function close(a,b,tol=1e-8){ return Math.abs(a-b) <= tol; }

function parseStandardFormInput(raw){
  // Accept forms like:
  // 3.2×10⁵   3.2x10^5   3.2E5   3.2×10-5  (Unicode superscripts supported)
  const s0 = String(raw ?? "").trim();
  if(!s0) return null;

  // Normalise
  let s = s0.replace(/\s+/g,"");
  s = s.replace(/×/g,"x").replace(/⋅/g,"x").replace(/·/g,"x");
  s = s.replace(/EXP/ig,"E");
  s = s.replace(/[−–—]/g,"-"); // unicode minus/dashes

  // Convert Unicode superscripts to normal digits/sign
  const supMap = {"⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁻":"-","⁺":"+"};
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, ch => supMap[ch] ?? ch);

  // Standardise multiply symbol
  s = s.replace(/X/g,"x");

  // Pattern A: mantissa E exponent
  let m = s.match(/^([+-]?\d*\.?\d+)E([+-]?\d+)$/i);
  if(m){
    const mantissa = Number(m[1]);
    const exp = parseInt(m[2],10);
    if(!Number.isFinite(mantissa) || !Number.isFinite(exp)) return null;
    return {mantissa, exp, value: mantissa * Math.pow(10, exp)};
  }

  // Pattern B: mantissa × 10 ^ exponent  (caret optional, exponent may follow immediately after 10)
  m = s.match(/^([+-]?\d*\.?\d+)(?:x|\*)10\^?([+-]?\d+)$/i);
  if(m){
    const mantissa = Number(m[1]);
    const exp = parseInt(m[2],10);
    if(!Number.isFinite(mantissa) || !Number.isFinite(exp)) return null;
    return {mantissa, exp, value: mantissa * Math.pow(10, exp)};
  }

  return null;
}


/* -------------------- MathML helpers -------------------- */
const MNS = `http://www.w3.org/1998/Math/MathML`;
function mfrac(n,d){
  return `<span class="mathwrap"><math xmlns="${MNS}" display="inline"><mfrac><mn>${n}</mn><mn>${d}</mn></mfrac></math></span>`;
}
function msup(base, exp){
  const baseNode = Number.isFinite(+base) ? `<mn>${base}</mn>` : `<mi>${String(base)}</mi>`;
  return `<span class="mathwrap"><math xmlns="${MNS}" display="inline"><msup>${baseNode}<mn>${exp}</mn></msup></math></span>`;
}

// SECTION: Topic list / tab navigation
// EDIT HERE: To add/remove topics or change the tab label, edit the TOPICS array below.
// NOTE: Each `code` must have a corresponding `case "CODE"` in the buildQuestion() switch.
/* SPLITMERGE:TOPICS-START */
const TOPICS = [
  {code:"N7",  name:"Multiplication (integers & decimals)"},
  {code:"N8",  name:"Division (integers & decimals)"},
  {code:"N9",  name:"Negative numbers (mixed operations)"}
];
/* SPLITMERGE:TOPICS-END */

/* -------------------- number pickers -------------------- */
function pickDec(rng, dp){
  // dp digits after decimal, always non-trailing safe
  const m = 10**dp;
  return rng.int(1*m, 999*m)/m;
}
function pickMoney(rng, isCalc){
  // money prices: noncalc => 2 dp but friendly; calc => awkward 2 dp
  const pennies = isCalc ? rng.int(105, 2999) : rng.choice([125,150,175,200,225,250,275,300,350,400,450,500,550,600,650,700,750,800,900,1000,1200,1500]);
  return pennies/100;
}
function pickNiceInt(rng, min=2, max=40){ return rng.int(min, max); }
function pickBigInt(rng){ return rng.int(1200, 98000); }

function pickPercent(rng, allowOneDp=false){
  // GCSE-friendly percentages (no recurring). If allowOneDp, may return values like 12.5 or 7.5.
  const ints = [1,2,3,4,5,6,8,10,12,15,18,20,25,30,35,40,45,50,60,75,80,90];
  const oneDp = [2.5,7.5,12.5,17.5,22.5,37.5,62.5];
  return allowOneDp ? rng.choice(ints.concat(oneDp)) : rng.choice(ints);
}

/* -------------------- part constructors -------------------- */
function partNumber(id, textHtml, marks, value){
  return {marks, textHtml, input:{kind:"number", id}, answer:{type:"number", value}};
}
function partInteger(id, textHtml, marks, value){
  return {marks, textHtml, input:{kind:"integer", id}, answer:{type:"number", value}};
}
function partFraction(id, textHtml, marks, frac){
  return {marks, textHtml, input:{kind:"fraction", id}, answer:{type:"fraction", value: frac}};
}
function partPair(id, textHtml, marks, pair, opts={}){
  return {marks, textHtml, input:{kind:(opts.kind||"pair"), id, placeholders:opts.placeholders, labels:opts.labels}, answer:{type:"pair", value: pair}};
}
function partStdForm(id, textHtml, marks, val, nMaybe){
  // val can be:
  //  - the actual numeric value to be written in standard form, OR
  //  - (A, n) where val is A and nMaybe is the power of 10.
  const num = (typeof nMaybe !== "undefined")
    ? (Number(val) * (10**Number(nMaybe)))
    : Number(val);
  return {marks, textHtml, input:{kind:"standardForm", id}, answer:{type:"standardForm", value: num}};
}
function partOrder(id, textHtml, marks, correctTokens){
  return {marks, textHtml, input:{kind:"order", id}, answer:{type:"order", value: correctTokens}};
}
function partPrimeFactors(id, textHtml, marks, primeMap){
  // primeMap: {2:3, 3:1, ...}
  return {marks, textHtml, input:{kind:"primeFactors", id}, answer:{type:"primeFactors", value: primeMap}};
}
function partMoney(id, textHtml, marks, value){
  return {marks, textHtml, input:{kind:"money", id}, answer:{type:"number", value}};
}

// Display-only block (no input / no marks). Useful for putting tables above part (a)/(b)
// so that answer boxes align horizontally with the question line.
function partDisplay(textHtml){
  return {marks:0, textHtml, input:null, answer:null};
}

// Rounded-number marking:
// - Full marks if the calculation is correct and the student has rounded to <= dpReq.
// - If the calculation is correct but rounding is not done (too many decimal places), deduct 1 mark.
// - If the rounding is incorrect but within ±1 of the last required decimal place, deduct 1 mark.
function partRounded(id, textHtml, marks, rawValue, dpReq, kind="number"){
  const raw = Number(rawValue);
  const dp = Number(dpReq);
  return {
    marks,
    textHtml,
    input:{kind, id},
    answer:{type:"rounded", value: roundTo(raw, dp), raw, dp}
  };
}

function partSymbol(id, textHtml, marks, value){
  return {marks, textHtml, input:{kind:"symbol", id}, answer:{type:"symbol", value}};
}

/* -------------------- prime factor helpers -------------------- */
function factorise(n){
  // returns map {p:exp}, n is integer >=2
  let x = Math.abs(Math.trunc(n));
  const map = {};
  let p = 2;
  while(p*p <= x){
    while(x % p === 0){
      map[p] = (map[p]||0) + 1;
      x = Math.trunc(x/p);
    }
    p = (p===2) ? 3 : p+2;
  }
  if(x>1) map[x] = (map[x]||0)+1;
  return map;
}
function mapsEqual(a,b){
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if(ka.length!==kb.length) return false;
  for(let i=0;i<ka.length;i++){
    if(ka[i]!==kb[i]) return false;
    if(a[ka[i]]!==b[kb[i]]) return false;
  }
  return true;
}

// SECTION: Build one question card (topic + mark band)
// EDIT HERE: Each topic's question generator lives inside the switch(topicCode) below.
// - Adjust wording/values/answer keys within a topic `case`.
// - Keep IDs/classnames stable (the UI + checking logic rely on them).
// - To add a new topic, add it to TOPICS and add a matching case in this switch.
function buildQuestion(topicCode, marksTotal, paperMode, rng){
  const isCalc = paperMode === "calc";

  // SECTION: Scenario/context variants (3+ marks only)
  // These are injected directly into the student-facing prompt text (no separate context label above the question).
  // CHANGE REQUESTS #5/#6: N5 and N11 contexts are now specific and randomly selected.
  const contextVariants = (code)=>{
    switch(code){
      case "N7":
      case "N47":
        return [
        "A customer is buying items in a local shop.",
        "A group is buying tickets and snacks at a cinema.",
        "A charity stall is selling items to raise money."
        ];
      case "N46":
        return [
        "A cyclist records a distance and the time taken for a journey.",
        "A driver records a distance and the time taken for a trip.",
        "A runner records a distance and the time taken for training."
        ];
      case "N48":
        return [
        "A student uses a timetable to work out times during the day.",
        "A traveller plans a journey using start times and durations.",
        "An athlete uses race times and durations to plan a schedule."
        ];
      case "N37":
      case "N38":
      case "N39":
      case "N49":
      case "N50":
        return [
        "A scientist writes very large numbers using standard form.",
        "A lab report uses standard form for very small measurements.",
        "A computer stores very large and very small values in standard form."
        ];
      case "N43":
      case "N44":
      case "N45":
        return [
        "A technician records a measurement rounded to a stated accuracy.",
        "A coach records a distance or time rounded to a stated accuracy.",
        "A science experiment records readings rounded to a stated accuracy."
        ];
      // CHANGE REQUEST #6 (N11): Replace vague scenario prompts with specific, realistic contexts.
      case "N11":
        return [
        "A café uses a till that does two steps to work out a bill total.",
        "A delivery company uses a two-step rule to work out charges for parcels.",
        "A school club uses a two-step rule to work out how many packs are needed."
        ];
      case "N12":
      case "N13":
      case "N14":
      case "N15":
      case "N16":
      case "N32":
        return [
        "Items are being packed into equal groups.",
        "A team is arranging equipment evenly.",
        "A factory is making products in equal batches."
        ];
      case "N17":
      case "N18":
      case "N19":
      case "N20":
      case "N21":
      case "N22":
      case "N23":
      case "N24":
      case "N25":
      case "N26":
      case "N31":
        return [
        "A recipe uses fractional amounts of ingredients and portions.",
        "A DIY job uses fractions to measure, cut and share materials.",
        "A sports setting uses fractions of a lap or a match."
        ];
      // CHANGE REQUEST #5 (N5): Provide specific contexts for addition/subtraction (including negatives).
      case "N5":
        return [
        "A bank account changes with deposits and withdrawals.",
        "A temperature changes overnight, then changes again during the day.",
        "A football team tracks points gained and points lost across two matches."
        ];
      case "N27":
      case "N28":
      case "N29":
      case "N30":
      case "N33":
      case "N34":
      case "N35":
      case "N36":
        return [
        "A shop is using prices, discounts and offers.",
        "A charity is tracking amounts towards a target.",
        "A school is comparing scores and attendance figures."
        ];
      default:
        return [
        "A student is using numbers from an everyday situation.",
        "Someone is using numbers to complete a practical task.",
        "A real-life problem requires interpreting numbers accurately."
        ];
    }
  };

  // helper: create object
  const Q = (parts)=>{
    // For 3–5 mark questions, randomly select ONE of three context variants
    // and prepend it to the prompt. (Maths stays identical; only the setting changes.)
    if(marksTotal>=3 && !["N7","N8"].includes(topicCode)){
      const leads = contextVariants(topicCode) || [];
      if(leads.length>=3){
        const lead = rng.choice(leads);
        for(const p of parts){
          if(p && typeof p.textHtml==="string" && p.textHtml.trim()!==""){
            // Insert the chosen scenario into the question text itself (no separate context line).
            const original = p.textHtml;
            const trimmed = original.trimStart();
            if(trimmed.toLowerCase().startsWith('<p')){
              const idx = original.toLowerCase().indexOf('<p');
              const end = original.indexOf('>', idx);
              if(end !== -1){
                p.textHtml = original.slice(0, end+1) + lead + ' ' + original.slice(end+1);
              } else {
                p.textHtml = lead + ' ' + original;
              }
            } else {
              p.textHtml = lead + ' ' + original;
            }
            break;
          }
        }
      }
    }
    return {topicCode, marksTotal, paperMode, parts};
  };

  // helper: "calc style" rounding to 2 dp for awkward results
  const need2dp = isCalc; // calculator questions will often say 2 d.p.

  switch(topicCode){
    /* SPLITMERGE:BUILDQUESTION-CASES-START */    case "N7": {
      // N7 — Multiplication (scenario-based)
      // - Scenario 1 is money; scenarios 2 & 3 are non-money
      // - Tables used only for 4- and 5-mark questions
      // - Non-calculator: whole numbers (except simple decimal × 10/100/1000 style)
      // - Calculator: decimals used in the question
      // - (a) / (b) labels are bold

      const sc = rng.int(1,3);

      const fmtMoney = (x)=>{
        const s = Number(x).toFixed(2);
        return s.replace(/\.00$/,'');
      };

      // Money with 2 d.p. (avoids whole pounds like 12.00)
      const money2dp = (minP, maxP)=>{
        let p;
        do{ p = rng.int(minP, maxP); }while(p % 100 === 0);
        return p/100;
      };

      // Decimal with a chosen dp, avoiding integers
      const decDp = (min, max, dp)=>{
        const scale = 10**dp;
        let v;
        for(let i=0;i<500;i++){
          v = rng.int(Math.ceil(min*scale), Math.floor(max*scale)) / scale;
          if(!Number.isInteger(v)) return v;
        }
        return (Math.ceil(min*scale)+1)/scale;
      };

      const dpWord = (dp)=> dp===1 ? "decimal place" : "decimal places";

      // ensure two item quantities in the same sentence are different (e.g. 3 and 5, not 4 and 4)
      const pickDiffInt = (min, max, notVal)=>{
        let v = rng.int(min, max);
        let guard = 0;
        while(v===notVal && guard<25){
          v = rng.int(min, max);
          guard++;
        }
        if(v===notVal){
          v = (notVal!==min) ? min : max;
        }
        return v;
      };

      // ---------- NON-CALCULATOR ----------
      if(!isCalc){
        if(marksTotal===1){
          if(sc===1){
            // 2-digit × 1-digit
            const price = rng.int(10, 30);
            const qty = rng.int(3, 9);
            return Q([
              partMoney("n7_1_nc_s1", `A bus ticket costs <b>£${price}</b>. Work out the cost of <b>${qty}</b> tickets. <span class="endmark">[1]</span>`, 1, price*qty),
            ]);
          }
          if(sc===2){
            // 2-digit × 1-digit
            const rate = rng.int(10, 99);
            const mins = rng.int(3, 9);
            return Q([
              partInteger("n7_1_nc_s2", `A machine packs <b>${rate}</b> boxes per minute. How many boxes in <b>${mins}</b> minutes? <span class="endmark">[1]</span>`, 1, rate*mins),
            ]);
          }

          // simple decimal × 10/100 (non-calculator friendly)
          const laps = rng.choice([10, 100]);
          const lapKm = roundTo(decDp(0.11, 0.99, 2), 2); // km
          const dist = roundTo(lapKm * laps, 2);
          return Q([
            partNumber("n7_1_nc_s3", `One lap is <b>${fmt(lapKm,2)} km</b>. A runner does <b>${laps}</b> laps. Work out the distance. <span class="endmark">[1]</span>`, 1, dist),
          ]);
        }

        if(marksTotal===2){
          // Single 2-digit × 2-digit multiplication
          if(sc===1){
            let sandwich; do{ sandwich = rng.int(11, 25); }while(sandwich%10===0);
            let qSand; do{ qSand = rng.int(11, 29); }while(qSand%10===0);
            const total = sandwich*qSand;
            return Q([
              partMoney("n7_2_nc_s1", `A sandwich costs <b>£${sandwich}</b>. A customer buys <b>${qSand}</b> sandwiches. Work out the total cost. <span class="endmark">[2]</span>`, 2, total),
            ]);
          }
          if(sc===2){
            let perBook; do{ perBook = rng.int(21, 48); }while(perBook%10===0);
            let nBook; do{ nBook = rng.int(11, 25); }while(nBook%10===0);
            const total = perBook*nBook;
            return Q([
              partInteger("n7_2_nc_s2", `A printer makes <b>${perBook}</b> pages per booklet. It prints <b>${nBook}</b> booklets. Work out the total pages. <span class="endmark">[2]</span>`, 2, total),
            ]);
          }

          let gym; do{ gym = rng.int(31, 75); }while(gym%10===0);
          let nGym; do{ nGym = rng.int(11, 25); }while(nGym%10===0);
          const total = gym*nGym;
          return Q([
            partInteger("n7_2_nc_s3", `A gym session lasts <b>${gym}</b> minutes. A person does <b>${nGym}</b> gym sessions. Work out the total time. <span class="endmark">[2]</span>`, 2, total),
          ]);
        }

        if(marksTotal===3){
          if(sc===1){
            // DEAL (vary the offer to improve number variation)
            const price = rng.int(10, 25);

            // buy X for the price of Y (Y < X)
            const offers = [
              {buy:3, pay:2},
              {buy:4, pay:3},
              {buy:5, pay:4},
              {buy:4, pay:2},
              {buy:5, pay:3},
            ];
            const offer = rng.choice(offers);

            // Choose a multiple of the offer size so the offer applies neatly
            const mult = (offer.buy===3)
              ? rng.int(10,15)   // 30–45
              : (offer.buy===4)
                ? rng.int(8,12)  // 32–48
                : rng.int(6,10); // 30–50

            const bought = mult * offer.buy;
            const payFor = mult * offer.pay;
            const total = price * payFor;

            return Q([
              partMoney("n7_3_nc_s1", `A café sells muffins for <b>£${price}</b> each.<br>Offer: “Buy <b>${offer.buy}</b> muffins for the price of <b>${offer.pay}</b>.”<br>A customer buys <b>${bought}</b> muffins.<br>Work out the total cost using the offer. <span class="endmark">[3]</span>`, 3, total),
            ]);
          }
          if(sc===2){
            const rate = rng.int(10, 25);
            const sat = rng.int(6, 9);
            const sun = pickDiffInt(6, 9, sat);
            const hours = sat + sun; // 12–18
            const pay = rate * hours;
            return Q([
              partMoney("n7_3_nc_s2", `A worker earns <b>£${rate}</b> per hour.<br>They work <b>${sat}</b> hours on Saturday and <b>${sun}</b> hours on Sunday.<br>Work out their total pay. <span class="endmark">[3]</span>`, 3, pay),
            ]);
          }

          const perTrip = rng.int(10, 30);
          const mon = rng.int(6, 9);
          const tue = pickDiffInt(6, 9, mon);
          const trips = mon + tue;
          const totalDist = perTrip * trips;
          return Q([
            partInteger("n7_3_nc_s3", `A delivery driver travels <b>${perTrip}</b> km per trip.<br>On Monday they do <b>${mon}</b> trips. On Tuesday they do <b>${tue}</b> trips.<br>Work out the total distance travelled. <span class="endmark">[3]</span>`, 3, totalDist),
          ]);
        }

        if(marksTotal===4){
          // Tables; marking structure:
          // (a) [1] one item type only
          // (b) [3] two item types + TOTAL for ALL items (includes part a)
          if(sc===1){
            // Money table
            const tshirt = rng.int(6, 15);
            const cap = rng.int(10, 20); // 2-digit for 1-mark component
            const hoodie = rng.int(15, 35);
            const socks = rng.int(2, 8);

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>T-shirt</td><td class="num">£${tshirt}</td></tr>
                <tr><td>Cap</td><td class="num">£${cap}</td></tr>
                <tr><td>Hoodie</td><td class="num">£${hoodie}</td></tr>
                <tr><td>Socks</td><td class="num">£${socks}</td></tr>
              </table>`;

            const items = [
              {name:"T-shirt", plural:"T-shirts", cost:tshirt},
              {name:"Cap", plural:"caps", cost:cap},
              {name:"Hoodie", plural:"hoodies", cost:hoodie},
              {name:"Socks", plural:"pairs of socks", cost:socks},
            ];

            // Part (a): choose an item with a 2-digit cost where possible
            const eligibleA = items.filter(it => it.cost >= 10);
            const itemA = rng.choice((eligibleA.length ? eligibleA : items));
            const qA = rng.int(2,5);

            const remaining = items.filter(it => it.name !== itemA.name);
            const chosen = rng.shuffle(remaining).slice(0,2);
            const q1 = rng.int(2,5);
            const q2 = pickDiffInt(2,5,q1);

            const aAns = qA*itemA.cost;
            const bAns = aAns + q1*chosen[0].cost + q2*chosen[1].cost;

            return Q([
              partMoney("n7_4_nc_s1a", `A shop sells items at the prices shown.${table}<br><b>(a)</b> Work out the cost of <b>${qA}</b> ${itemA.plural}. <span class="endmark">[1]</span>`, 1, aAns),
              partMoney("n7_4_nc_s1b", `<b>(b)</b> A customer also buys <b>${q1}</b> ${chosen[0].plural} and <b>${q2}</b> ${chosen[1].plural}.<br>Work out the <b>TOTAL</b> cost for <b>ALL</b> the items bought. <span class="endmark">[3]</span>`, 3, bAns),
            ]);
          }
          if(sc===2){
            // Journey time table
            const s2c = rng.int(12, 25);
            const c2s = rng.int(10, 20);
            const s2sh = rng.int(12, 22);
            const sh2s = rng.int(15, 28);

            const table = `
              <table class="qtable">
                <tr><th>Journey</th><th class="num">Time (minutes)</th></tr>
                <tr><td>Station to College</td><td class="num">${s2c}</td></tr>
                <tr><td>College to Sports Hall</td><td class="num">${c2s}</td></tr>
                <tr><td>Sports Hall to Shops</td><td class="num">${s2sh}</td></tr>
                <tr><td>Shops to Station</td><td class="num">${sh2s}</td></tr>
              </table>`;

            const journeys = [
              {route:"Station to College", time:s2c},
              {route:"College to Sports Hall", time:c2s},
              {route:"Sports Hall to Shops", time:s2sh},
              {route:"Shops to Station", time:sh2s},
            ];

            const itemA = rng.choice(journeys);
            const qA = rng.int(2,5);

            const remaining = journeys.filter(j => j.route !== itemA.route);
            const chosen = rng.shuffle(remaining).slice(0,2);
            const q1 = rng.int(2,5);
            const q2 = pickDiffInt(2,5,q1);

            const aAns = qA*itemA.time;
            const bAns = aAns + q1*chosen[0].time + q2*chosen[1].time;

            return Q([
              partInteger("n7_4_nc_s2a", `A taxi firm records journey times.${table}<br><b>(a)</b> Work out the time for <b>${qA}</b> journeys from ${itemA.route}. <span class="endmark">[1]</span>`, 1, aAns),
              partInteger("n7_4_nc_s2b", `<b>(b)</b> A driver also makes <b>${q1}</b> journeys from ${chosen[0].route} and <b>${q2}</b> journeys from ${chosen[1].route}.<br>Work out the <b>TOTAL</b> time for <b>ALL</b> the journeys. <span class="endmark">[3]</span>`, 3, bAns),
            ]);
          }

          // Electricity table
          const kettle = rng.choice([1200,1500,1800,2000,2200]);
          const micro = rng.choice([700,800,900]);
          const tv = rng.choice([90,120,150,180]);
          const lamp = rng.choice([40,60,75,100]);

          const table = `
            <table class="qtable">
              <tr><th>Appliance</th><th class="num">Power (W)</th></tr>
              <tr><td>Kettle</td><td class="num">${kettle}</td></tr>
              <tr><td>Microwave</td><td class="num">${micro}</td></tr>
              <tr><td>TV</td><td class="num">${tv}</td></tr>
              <tr><td>Lamp</td><td class="num">${lamp}</td></tr>
            </table>`;

          const appliances = [
            {name:"Kettle", plural:"kettles", val:kettle},
            {name:"Microwave", plural:"microwaves", val:micro},
            {name:"TV", plural:"TVs", val:tv},
            {name:"Lamp", plural:"lamps", val:lamp},
          ];

          const itemA = rng.choice(appliances);
          const qA = rng.int(2,5);

          const remaining = appliances.filter(a => a.name !== itemA.name);
          const chosen = rng.shuffle(remaining).slice(0,2);
          const q1 = rng.int(2,5);
          const q2 = pickDiffInt(2,5,q1);

          const aAns = qA*itemA.val;
          const bAns = aAns + q1*chosen[0].val + q2*chosen[1].val;

          return Q([
            partInteger("n7_4_nc_s3a", `The power of appliances is shown.${table}<br><b>(a)</b> Work out the power for <b>${qA}</b> ${itemA.plural} running at the same time. <span class="endmark">[1]</span>`, 1, aAns),
            partInteger("n7_4_nc_s3b", `<b>(b)</b> A household also uses <b>${q1}</b> ${chosen[0].plural} and <b>${q2}</b> ${chosen[1].plural} (at the same time).<br>Work out the <b>TOTAL</b> power for <b>ALL</b> of these appliances. <span class="endmark">[3]</span>`, 3, bAns),
          ]);
        }


if(marksTotal===5){
          // Tables; mixed styles
          if(sc===1){
            // Keep totals below £100 so the change is always positive.
            const planner = rng.int(2, 5);
            const pen = rng.int(2, 4);
            const calc = rng.int(6, 10);
            const ruler = rng.int(1, 2);

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>Planner</td><td class="num">£${planner}</td></tr>
                <tr><td>Pen pack</td><td class="num">£${pen}</td></tr>
                <tr><td>Calculator</td><td class="num">£${calc}</td></tr>
                <tr><td>Ruler</td><td class="num">£${ruler}</td></tr>
              </table>`;

            // Randomise which items are used in parts (a) and (b) (and the order they are mentioned)
            const items = [
              {name:"Planner", plural:"planners", cost:planner},
              {name:"Pen pack", plural:"pen packs", cost:pen},
              {name:"Calculator", plural:"calculators", cost:calc},
              {name:"Ruler", plural:"rulers", cost:ruler},
            ];
            const chosenItems = rng.shuffle(items);
            const aItems = chosenItems.slice(0,2);
            const bItems = chosenItems.slice(2);

            let qA1, qA2, qB1, qB2;
            let aTotal, allTotal, change;

            for(let tries=0; tries<200; tries++){
              qA1 = rng.int(2,5);
              qA2 = pickDiffInt(2,5,qA1);
              qB1 = rng.int(2,5);
              qB2 = pickDiffInt(2,5,qB1);

              aTotal = qA1*aItems[0].cost + qA2*aItems[1].cost;
              allTotal = aTotal + qB1*bItems[0].cost + qB2*bItems[1].cost;
              change = 100 - allTotal;

              if(change >= 0) break;
            }

            return Q([
              partMoney("n7_5_nc_s1a", `A school shop sells items.${table}<br><b>(a)</b> A student buys <b>${qA1}</b> ${aItems[0].plural} and <b>${qA2}</b> ${aItems[1].plural}.<br>Work out the total cost. <span class="endmark">[2]</span>`, 2, aTotal),
              partMoney("n7_5_nc_s1b", `<b>(b)</b> The student also buys <b>${qB1}</b> ${bItems[0].plural} and <b>${qB2}</b> ${bItems[1].plural}.<br>They pay with <b>£100</b>.<br>Work out the change they get. <span class="endmark">[3]</span>`, 3, change),
            ]);
          }

          if(sc===2){
            const gloves = rng.int(12, 30);
            const bottles = rng.int(10, 24);
            const tins = rng.int(8, 20);
            const sponges = rng.int(12, 35);

            const table = `
              <table class="qtable">
                <tr><th>Item type</th><th class="num">Items per box</th></tr>
                <tr><td>Gloves</td><td class="num">${gloves}</td></tr>
                <tr><td>Bottles</td><td class="num">${bottles}</td></tr>
                <tr><td>Tins</td><td class="num">${tins}</td></tr>
                <tr><td>Sponges</td><td class="num">${sponges}</td></tr>
              </table>`;

            // Randomise which item types are used in each part (and their order)
            const itemTypes = [
              {name:"gloves", phrase:"boxes of gloves", per:gloves},
              {name:"bottles", phrase:"boxes of bottles", per:bottles},
              {name:"tins", phrase:"boxes of tins", per:tins},
              {name:"sponges", phrase:"boxes of sponges", per:sponges},
            ];
            const chosen = rng.shuffle(itemTypes);
            const aItems = chosen.slice(0,2);
            const bItems = chosen.slice(2);

            const bA1 = rng.int(2,5);
            const bA2 = pickDiffInt(2,5,bA1);
            const bB1 = rng.int(2,5);
            const bB2 = pickDiffInt(2,5,bB1);

            const aTotal = bA1*aItems[0].per + bA2*aItems[1].per;
            const allTotal = aTotal + bB1*bItems[0].per + bB2*bItems[1].per;

            return Q([
              partInteger("n7_5_nc_s2a", `A warehouse packs items into boxes.${table}<br><b>(a)</b> The warehouse packs <b>${bA1}</b> ${aItems[0].phrase} and <b>${bA2}</b> ${aItems[1].phrase}.<br>Work out the number of items packed. <span class="endmark">[2]</span>`, 2, aTotal),
              partInteger("n7_5_nc_s2b", `<b>(b)</b> It also packs <b>${bB1}</b> ${bItems[0].phrase} and <b>${bB2}</b> ${bItems[1].phrase}.<br>Work out the <b>TOTAL</b> number of items packed altogether for <b>ALL</b> boxes. <span class="endmark">[3]</span>`, 3, allTotal),
            ]);
          }

          // sessions
          const swim = rng.int(30, 60);
          const fit = rng.int(45, 75);
          const yoga = rng.int(30, 60);
          const bad = rng.int(35, 70);

          const table = `
            <table class="qtable">
              <tr><th>Session type</th><th class="num">Minutes per session</th></tr>
              <tr><td>Swimming</td><td class="num">${swim}</td></tr>
              <tr><td>Fitness class</td><td class="num">${fit}</td></tr>
              <tr><td>Yoga</td><td class="num">${yoga}</td></tr>
              <tr><td>Badminton</td><td class="num">${bad}</td></tr>
            </table>`;

          const sessions = [
            {name:"Swimming", plural:"swimming sessions", mins:swim},
            {name:"Fitness class", plural:"fitness classes", mins:fit},
            {name:"Yoga", plural:"yoga sessions", mins:yoga},
            {name:"Badminton", plural:"badminton sessions", mins:bad},
          ];

          // Randomise which session types are used in week 1 and week 2 (and the order mentioned)
          const chosen = rng.shuffle(sessions);
          const week1Sessions = chosen.slice(0,2);
          const week2Sessions = chosen.slice(2);

          const n1 = rng.int(2,5);
          const n2 = pickDiffInt(2,5,n1);
          const n3 = rng.int(2,5);
          const n4 = pickDiffInt(2,5,n3);

          const week1 = n1*week1Sessions[0].mins + n2*week1Sessions[1].mins;
          const week2 = n3*week2Sessions[0].mins + n4*week2Sessions[1].mins;
          const left = 2000 - (week1 + week2);

          return Q([
            partInteger("n7_5_nc_s3a", `A leisure centre runs sessions.${table}<br><b>(a)</b> In one week, the centre runs <b>${n1}</b> ${week1Sessions[0].plural} and <b>${n2}</b> ${week1Sessions[1].plural}.<br>Work out the total minutes. <span class="endmark">[2]</span>`, 2, week1),
            partInteger("n7_5_nc_s3b", `<b>(b)</b> In the next week, it runs <b>${n3}</b> ${week2Sessions[0].plural} and <b>${n4}</b> ${week2Sessions[1].plural}.<br>A member has <b>2000</b> minutes available across both weeks.<br>Work out how many minutes are left. <span class="endmark">[3]</span>`, 3, left),
          ]);
        }
      }

      // ---------- CALCULATOR ----------
      if(marksTotal===1){
        if(sc===1){
          // ticket cost (3-digit × 2-digit, decimals included)
          const price = money2dp(1200, 9999); // £12.00–£99.99
          const qty = (rng.float() < 0.7) ? rng.int(120, 360) : rng.int(12, 96);
          const total = roundTo(price * qty, 2);
          return Q([
            partMoney("n7_1_c_s1", `A bus ticket costs <b>£${price.toFixed(2)}</b>. Work out the cost of <b>${qty}</b> tickets. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, total),
          ]);
        }
        if(sc===2){
          // boxes per minute (2-digit × 2-digit, decimals included)
          const rate = decDp(10.1, 99.9, 1);
          const mins = rng.int(12, 30);
          const total = roundTo(rate * mins, 1);
          return Q([
            partNumber("n7_1_c_s2", `A pump moves <b>${fmt(rate,1)}</b> litres of water per minute. It runs for <b>${mins}</b> minutes. Work out the total litres of water moved. Give your answer to <b>1</b> decimal place. <span class="endmark">[1]</span>`, 1, total),
          ]);
        }

        const lap = decDp(120.1, 899.9, 1);
        const laps = rng.int(12, 30);
        const total = roundTo(lap * laps, 1);
        return Q([
          partNumber("n7_1_c_s3", `One lap is <b>${fmt(lap,1)} m</b>. A runner does <b>${laps}</b> laps. Work out the distance. Give your answer to <b>1</b> decimal place. <span class="endmark">[1]</span>`, 1, total),
        ]);
      }

      if(marksTotal===2){
        if(sc===1){
          const sandwich = money2dp(1000, 2599);
          const qSand = rng.int(10, 29);
          const total = roundTo(sandwich*qSand, 2);
          return Q([
            partMoney("n7_2_c_s1", `A sandwich costs <b>£${sandwich.toFixed(2)}</b>. A customer buys <b>${qSand}</b> sandwiches. Work out the total cost. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, total),
          ]);
        }
        if(sc===2){
          const perBook = decDp(20.1, 48.9, 1);
          const nBook = rng.int(10, 25);
          const total = roundTo(perBook*nBook, 2);
          return Q([
            partNumber("n7_2_c_s2", `A printer uses <b>${fmt(perBook,1)}</b> g of ink for each booklet. It prints <b>${nBook}</b> booklets. Work out the total mass of ink used, in g. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, total),
          ]);
        }

        const gym = decDp(30.1, 75.9, 1);
        const nGym = rng.int(10, 25);
        const total = roundTo(gym*nGym, 2);
        return Q([
          partNumber("n7_2_c_s3", `A gym session lasts <b>${fmt(gym,1)}</b> minutes. A person does <b>${nGym}</b> gym sessions. Work out the total time. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, total),
        ]);
      }

      if(marksTotal===3){
        if(sc===1){
          const price = money2dp(1000, 2599);

          const offers = [
            {buy:3, pay:2},
            {buy:4, pay:3},
            {buy:5, pay:4},
            {buy:4, pay:2},
            {buy:5, pay:3},
          ];
          const offer = rng.choice(offers);

          const mult = (offer.buy===3)
            ? rng.int(10,15)
            : (offer.buy===4)
              ? rng.int(8,12)
              : rng.int(6,10);

          const bought = mult * offer.buy;
          const payFor = mult * offer.pay;

          const total = roundTo(price*payFor, 2);
          return Q([
            partMoney("n7_3_c_s1", `A café sells muffins for <b>£${price.toFixed(2)}</b> each.<br>Offer: “Buy <b>${offer.buy}</b> muffins for the price of <b>${offer.pay}</b>.”<br>A customer buys <b>${bought}</b> muffins.<br>Work out the total cost using the offer. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, total),
          ]);
        }
        if(sc===2){
          // produce ≥4 d.p. before rounding by using 2 d.p. × 2 d.p.
          const rate = money2dp(1000, 2599);
          const sat = roundTo(decDp(4.25, 8.75, 2), 2);
          let sun = roundTo(decDp(4.25, 8.75, 2), 2);
          let guardSun = 0;
          while(sun === sat && guardSun < 25){
            sun = roundTo(decDp(4.25, 8.75, 2), 2);
            guardSun++;
          }
          const raw = rate * (sat + sun);
          return Q([
            partRounded("n7_3_c_s2", `A worker earns <b>£${rate.toFixed(2)}</b> per hour.<br>They work <b>${fmt(sat,2)}</b> hours on Saturday and <b>${fmt(sun,2)}</b> hours on Sunday.<br>Work out their total pay to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, raw, 2, "money"),
          ]);
        }

        const perTrip = decDp(10.01, 30.99, 2); // 2 d.p. (max 2 d.p. shown in the question)
        const mon = rng.int(6, 9);
        const tue = pickDiffInt(6, 9, mon);
        const trips = mon + tue;
        const raw = perTrip * trips;
        const dpReq = rng.choice([1,2,3]);
        return Q([
          partRounded("n7_3_c_s3", `A delivery driver travels <b>${perTrip.toFixed(2)}</b> km per trip.<br>On Monday they do <b>${mon}</b> trips. On Tuesday they do <b>${tue}</b> trips.<br>Work out the total distance travelled, rounded to <b>${dpReq}</b> ${dpWord(dpReq)}. <span class="endmark">[3]</span>`, 3, raw, dpReq),
        ]);
      }

      if(marksTotal===4){
        if(sc===1){
          const tshirt = money2dp(600, 1500);
          const cap = money2dp(800, 2000);
          const hoodie = money2dp(1500, 3500);
          const socks = money2dp(100, 800);

          const table = `
            <table class="qtable">
              <tr><th>Item</th><th class="num">Cost</th></tr>
              <tr><td>T-shirt</td><td class="num">£${tshirt.toFixed(2)}</td></tr>
              <tr><td>Cap</td><td class="num">£${cap.toFixed(2)}</td></tr>
              <tr><td>Hoodie</td><td class="num">£${hoodie.toFixed(2)}</td></tr>
              <tr><td>Socks</td><td class="num">£${socks.toFixed(2)}</td></tr>
            </table>`;

          const items = [
            {name:"T-shirt", plural:"T-shirts", cost:tshirt},
            {name:"Cap", plural:"caps", cost:cap},
            {name:"Hoodie", plural:"hoodies", cost:hoodie},
            {name:"Socks", plural:"pairs of socks", cost:socks},
          ];

          // Part (a): choose a 2-digit-priced item where possible (to keep the 1-mark step non-trivial)
          const eligibleA = items.filter(it => it.cost >= 10);
          const itemA = rng.choice((eligibleA.length ? eligibleA : items));
          const qA = rng.int(2,5);

          const remaining = items.filter(it => it.name !== itemA.name);
          const chosen = rng.shuffle(remaining).slice(0,2);
          const q1 = rng.int(2,5);
          const q2 = pickDiffInt(2,5,q1);

          const rawA = qA*itemA.cost;
          const aAns = roundTo(rawA, 2);
          const bAns = roundTo(rawA + q1*chosen[0].cost + q2*chosen[1].cost, 2);

          return Q([
            partMoney("n7_4_c_s1a", `A shop sells items at the prices shown.${table}<br><b>(a)</b> Work out the cost of <b>${qA}</b> ${itemA.plural}. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, aAns),
            partMoney("n7_4_c_s1b", `<b>(b)</b> A customer also buys <b>${q1}</b> ${chosen[0].plural} and <b>${q2}</b> ${chosen[1].plural}.<br>Work out the <b>TOTAL</b> cost for <b>ALL</b> the items bought. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, bAns),
          ]);
        }
        if(sc===2){
          const s2c = decDp(12.0001, 25.9999, 2);
          const c2s = decDp(10.0001, 20.9999, 2);
          const s2sh = decDp(12.0001, 22.9999, 2);
          const sh2s = decDp(15.0001, 28.9999, 2);

          const table = `
            <table class="qtable">
              <tr><th>Journey</th><th class="num">Time (minutes)</th></tr>
              <tr><td>Station to College</td><td class="num">${s2c.toFixed(2)}</td></tr>
              <tr><td>College to Sports Hall</td><td class="num">${c2s.toFixed(2)}</td></tr>
              <tr><td>Sports Hall to Shops</td><td class="num">${s2sh.toFixed(2)}</td></tr>
              <tr><td>Shops to Station</td><td class="num">${sh2s.toFixed(2)}</td></tr>
            </table>`;

          const journeys = [
            {route:"Station to College", time:s2c},
            {route:"College to Sports Hall", time:c2s},
            {route:"Sports Hall to Shops", time:s2sh},
            {route:"Shops to Station", time:sh2s},
          ];

          const itemA = rng.choice(journeys);
          const qA = rng.int(2,5);

          const remaining = journeys.filter(j => j.route !== itemA.route);
          const chosen = rng.shuffle(remaining).slice(0,2);
          const q1 = rng.int(2,5);
          const q2 = pickDiffInt(2,5,q1);

          const rawA = qA*itemA.time;
          const aAns = roundTo(rawA, 2);
          const bAns = roundTo(rawA + q1*chosen[0].time + q2*chosen[1].time, 2);

          return Q([
            partNumber("n7_4_c_s2a", `A taxi firm records journey times.${table}<br><b>(a)</b> Work out the time for <b>${qA}</b> journeys from ${itemA.route}. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, aAns),
            partNumber("n7_4_c_s2b", `<b>(b)</b> A driver also makes <b>${q1}</b> journeys from ${chosen[0].route} and <b>${q2}</b> journeys from ${chosen[1].route}.<br>Work out the <b>TOTAL</b> time for <b>ALL</b> the journeys. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, bAns),
          ]);
        }

        // Power ratings in kW (decimals are realistic in this context)
        const kettle = decDp(1.20, 2.40, 2);
        const micro = decDp(0.70, 1.20, 2);
        const tv = decDp(0.09, 0.25, 2);
        const lamp = decDp(0.04, 0.15, 2);

        const table = `
          <table class="qtable">
            <tr><th>Appliance</th><th class="num">Power (kW)</th></tr>
            <tr><td>Kettle</td><td class="num">${kettle.toFixed(2)}</td></tr>
            <tr><td>Microwave</td><td class="num">${micro.toFixed(2)}</td></tr>
            <tr><td>TV</td><td class="num">${tv.toFixed(2)}</td></tr>
            <tr><td>Lamp</td><td class="num">${lamp.toFixed(2)}</td></tr>
          </table>`;

        const appliances = [
          {name:"Kettle", plural:"kettles", val:kettle},
          {name:"Microwave", plural:"microwaves", val:micro},
          {name:"TV", plural:"TVs", val:tv},
          {name:"Lamp", plural:"lamps", val:lamp},
        ];

        const itemA = rng.choice(appliances);
        const qA = rng.int(2,5);

        const remaining = appliances.filter(a => a.name !== itemA.name);
        const chosen = rng.shuffle(remaining).slice(0,2);
        const q1 = rng.int(2,5);
        const q2 = pickDiffInt(2,5,q1);

        const rawA = qA*itemA.val;
        const aAns = roundTo(rawA, 2);
        const bAns = roundTo(rawA + q1*chosen[0].val + q2*chosen[1].val, 2);

        return Q([
          partNumber("n7_4_c_s3a", `The power of appliances is shown.${table}<br><b>(a)</b> Work out the power for <b>${qA}</b> ${itemA.plural} running at the same time. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, aAns),
          partNumber("n7_4_c_s3b", `<b>(b)</b> A household also uses <b>${q1}</b> ${chosen[0].plural} and <b>${q2}</b> ${chosen[1].plural} (at the same time).<br>Work out the <b>TOTAL</b> power for <b>ALL</b> of these appliances. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, bAns),
        ]);
      }


if(marksTotal===5){
        if(sc===1){
          // Keep totals below £100 so the change is always positive.
          const planner = money2dp(200, 549);
          const pen = money2dp(200, 449);
          const calc = money2dp(600, 949);
          const ruler = money2dp(100, 199);

          const table = `
            <table class="qtable">
              <tr><th>Item</th><th class="num">Cost</th></tr>
              <tr><td>Planner</td><td class="num">£${planner.toFixed(2)}</td></tr>
              <tr><td>Pen pack</td><td class="num">£${pen.toFixed(2)}</td></tr>
              <tr><td>Calculator</td><td class="num">£${calc.toFixed(2)}</td></tr>
              <tr><td>Ruler</td><td class="num">£${ruler.toFixed(2)}</td></tr>
            </table>`;

          const items = [
            {name:"Planner", plural:"planners", cost:planner},
            {name:"Pen pack", plural:"pen packs", cost:pen},
            {name:"Calculator", plural:"calculators", cost:calc},
            {name:"Ruler", plural:"rulers", cost:ruler},
          ];
          const chosenItems = rng.shuffle(items);
          const aItems = chosenItems.slice(0,2);
          const bItems = chosenItems.slice(2);

          let qA1, qA2, qB1, qB2;
          let aTotal, allTotal, change;

          for(let tries=0; tries<300; tries++){
            qA1 = rng.int(2,5);
            qA2 = pickDiffInt(2,5,qA1);
            qB1 = rng.int(2,5);
            qB2 = pickDiffInt(2,5,qB1);

            aTotal = roundTo(qA1*aItems[0].cost + qA2*aItems[1].cost, 2);
            allTotal = roundTo(aTotal + qB1*bItems[0].cost + qB2*bItems[1].cost, 2);
            change = roundTo(100 - allTotal, 2);

            if(change >= 0) break;
          }

          return Q([
            partMoney("n7_5_c_s1a", `A school shop sells items.${table}<br><b>(a)</b> A student buys <b>${qA1}</b> ${aItems[0].plural} and <b>${qA2}</b> ${aItems[1].plural}.<br>Work out the total cost. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, aTotal),
            partMoney("n7_5_c_s1b", `<b>(b)</b> The student also buys <b>${qB1}</b> ${bItems[0].plural} and <b>${qB2}</b> ${bItems[1].plural}.<br>They pay with <b>£100</b>.<br>Work out the change they get. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, change),
          ]);
        }

        if(sc===2){
          // Realistic calculator context (decimals make sense): paint tins.
          // Using (2 d.p.) × (2 d.p.) ensures answers have ≥4 d.p. before rounding.
          const dpReq = rng.choice([1,2,3]);

          const paintNames = rng.shuffle(["Standard paint","Outdoor paint","Primer","Gloss"]);
          const rows = paintNames.map(name=>({
            name,
            vol: decDp(1.25, 6.25, 2),        // litres per tin
            cov: decDp(6.50, 15.50, 2)        // m² per litre
          }));

          const table = `
            <table class="qtable">
              <tr><th>Paint type</th><th class="num">Volume per tin (L)</th><th class="num">Coverage (m² per L)</th></tr>
              ${rows.map(r=>`<tr><td>${r.name}</td><td class="num">${r.vol.toFixed(2)}</td><td class="num">${r.cov.toFixed(2)}</td></tr>`).join("")}
            </table>`;

          const t1 = rng.int(2,5);
          const t2 = pickDiffInt(2,5,t1);
          const t3 = rng.int(2,5);
          const t4 = pickDiffInt(2,5,t3);

          const rawA = t1*(rows[0].vol*rows[0].cov) + t2*(rows[1].vol*rows[1].cov);
          const rawAll = rawA + t3*(rows[2].vol*rows[2].cov) + t4*(rows[3].vol*rows[3].cov);

          return Q([
            partRounded("n7_5_c_s2a", `A decorator uses paint. The table shows the volume of paint in each tin and the coverage rate.${table}<br><b>(a)</b> The decorator buys <b>${t1}</b> tins of <b>${rows[0].name}</b> and <b>${t2}</b> tins of <b>${rows[1].name}</b>.<br>Work out the total area that can be painted (in m²), rounded to <b>${dpReq}</b> ${dpWord(dpReq)}. <span class="endmark">[2]</span>`, 2, rawA, dpReq),
            partRounded("n7_5_c_s2b", `<b>(b)</b> The decorator also buys <b>${t3}</b> tins of <b>${rows[2].name}</b> and <b>${t4}</b> tins of <b>${rows[3].name}</b>.<br>Work out the <b>TOTAL</b> area that can be painted with all the tins (in m²), rounded to <b>${dpReq}</b> ${dpWord(dpReq)}. <span class="endmark">[3]</span>`, 3, rawAll, dpReq),
          ]);
        }

        // Realistic calculator context (decimals make sense): energy use.
        // Using (2 d.p.) × (2 d.p.) gives ≥4 d.p. in the unrounded totals.
        const dpReq = rng.choice([1,2,3]);

        const deviceNames = rng.shuffle(["Treadmill","Rowing machine","Exercise bike","Cross trainer"]);
        const rows = deviceNames.map(name=>({
          name,
          power: decDp(0.30, 2.50, 2),   // kW
          time: decDp(0.25, 1.75, 2)     // hours per session
        }));

        const table = `
          <table class="qtable">
            <tr><th>Equipment</th><th class="num">Power (kW)</th><th class="num">Time per session (hours)</th></tr>
            ${rows.map(r=>`<tr><td>${r.name}</td><td class="num">${r.power.toFixed(2)}</td><td class="num">${r.time.toFixed(2)}</td></tr>`).join("")}
          </table>`;

        const n1 = rng.int(2,5);
        const n2 = pickDiffInt(2,5,n1);
        const n3 = rng.int(2,5);
        const n4 = pickDiffInt(2,5,n3);

        const rawWeek1 = n1*(rows[0].power*rows[0].time) + n2*(rows[1].power*rows[1].time);
        const rawWeek2 = n3*(rows[2].power*rows[2].time) + n4*(rows[3].power*rows[3].time);
        const rawTotal = rawWeek1 + rawWeek2;

        // Budget shown to 2 d.p.; leftover keeps ≥4 d.p. because rawTotal has ≥4 d.p.
        let extra = decDp(5.25, 30.75, 2);
        let budget = roundTo(rawTotal, 2) + extra;
        budget = roundTo(budget, 2);
        // Avoid showing a whole number like 20.00
        if((Math.round(budget*100) % 100) === 0) budget = roundTo(budget + 0.01, 2);

        const rawLeft = budget - rawTotal;

        return Q([
          partRounded("n7_5_c_s3a", `A gym tracks energy use. The table shows the power of equipment and the time used per session.${table}<br><b>(a)</b> In one week, the gym runs <b>${n1}</b> sessions on <b>${rows[0].name}</b> and <b>${n2}</b> sessions on <b>${rows[1].name}</b>.<br>Work out the total energy used (in kWh), rounded to <b>${dpReq}</b> ${dpWord(dpReq)}. <span class="endmark">[2]</span>`, 2, rawWeek1, dpReq),
          partRounded("n7_5_c_s3b", `<b>(b)</b> In the next week, the gym runs <b>${n3}</b> sessions on <b>${rows[2].name}</b> and <b>${n4}</b> sessions on <b>${rows[3].name}</b>.<br>The gym has an energy budget of <b>${budget.toFixed(2)}</b> kWh for both weeks.<br>Work out how many kWh are left, rounded to <b>${dpReq}</b> ${dpWord(dpReq)}. <span class="endmark">[3]</span>`, 3, rawLeft, dpReq),
        ]);
      }

      // Fallback
      return Q([partInteger("n7_f", `Work out: <b>24 × 3</b>. <span class="endmark">[1]</span>`, 1, 72)]);
    }    case "N8": {
      // N8 — Division (with multiplication/addition/subtraction where needed) — GCSE style
      // Rules followed:
      // - Questions grouped by mark value (1–5), each with 3 scenario variants
      // - Scenario 1 is money; scenarios 2 & 3 are non-money
      // - Division is required in EVERY question
      // - If there are parts (a) and (b), BOTH parts contain division
      // - Tables used only for 4- and 5-mark questions
      // - Non-calculator: whole numbers in the question
      // - Calculator: decimals used in the question

      const sc = rng.int(1,3);

      // helpers
      const pickPence = (minP,maxP)=>{
        let p;
        do{ p = rng.int(minP,maxP); }while(p%100===0);
        return p;
      };
      const ceilDiv = (a,b)=> Math.floor((a + b - 1)/b);
      const gcd = (a,b)=>{ a=Math.abs(a); b=Math.abs(b); while(b){ const t=a%b; a=b; b=t; } return a; };

      // -------------------- 1 MARK --------------------
      if(marksTotal===1){
        if(sc===1){
          // Scenario 1 (Money): share equally
          if(!isCalc){
            // Non-calculator 1 mark: divide by a ONE-digit divisor
            const people = rng.choice([3,4,5,6,7,8,9]);
            const each = rng.int(8,30);
            const total = people*each;
            return Q([partMoney("n8_1", `£${total} is shared equally between <b>${people}</b> people. How much does each person get? <span class="endmark">[1]</span>`, 1, each)]);
          }else{
            const people = rng.choice([3,4,5,6,7,8,9,12]);
            const eachP = pickPence(600, 3500);
            const totalP = eachP*people;
            return Q([partMoney("n8_1c", `£${fmtNo00(totalP/100,2)} is shared equally between <b>${people}</b> people. How much does each person get? Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(eachP/100,2))]);
          }
        }

        if(sc===2){
          // Scenario 2 (Non-money: length): cut into equal pieces
          if(!isCalc){
            // Non-calculator 1 mark: divide by a ONE-digit divisor
            const pieces = rng.choice([3,4,5,6,7,8,9]);
            const each = rng.int(6,30);
            const total = pieces*each;
            return Q([partInteger("n8_1l", `A rope is <b>${total} cm</b> long. It is cut into <b>${pieces}</b> equal pieces. How long is each piece? <span class="endmark">[1]</span>`, 1, each)]);
          }else{
            const pieces = rng.choice([4,5,6,8,9,12]);
            let eachC = rng.int(50, 350); // 0.50–3.50 m (in hundredths)
            if(eachC%100===0) eachC+=15;
            const totalC = eachC*pieces;
            return Q([partNumber("n8_1lc", `A rope is <b>${fmtNo00(totalC/100,2)} m</b> long. It is cut into <b>${pieces}</b> equal pieces. How long is each piece? Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(eachC/100,2))]);
          }
        }

        // Scenario 3 (Non-money: mass): share equally
        if(!isCalc){
          // Non-calculator 1 mark: divide by a ONE-digit divisor
          const bowls = rng.choice([3,4,5,6,7,8,9]);
          const each = rng.int(40,200);
          const total = bowls*each;
          return Q([partInteger("n8_1m", `<b>${total} g</b> of pasta is shared equally into <b>${bowls}</b> bowls. How many grams are in each bowl? <span class="endmark">[1]</span>`, 1, each)]);
        }else{
          const containers = rng.choice([4,5,6,8,9,12]);
          let eachC = rng.int(20, 250); // 0.20–2.50 kg (hundredths)
          if(eachC%100===0) eachC+=7;
          const totalC = eachC*containers;
          return Q([partNumber("n8_1mc", `<b>${fmtNo00(totalC/100,2)} kg</b> of rice is shared equally into <b>${containers}</b> containers. How many kilograms are in each container? Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(eachC/100,2))]);
        }
      }


// -------------------- 2 MARK --------------------
      if(marksTotal===2){
        if(sc===1){
          // Scenario 1 (Money): share equally
          if(!isCalc){
            // Non-calculator 2 marks: ONE division by a TWO-digit divisor
            const people = rng.choice([12,15,16,18,21,24,25,28]);
            const each = rng.int(5,30);
            const total = people*each;
            return Q([partMoney("n8_2", `£${total} is shared equally between <b>${people}</b> people. How much does each person get? <span class="endmark">[2]</span>`, 2, each)]);
          }else{
            const people = rng.choice([6,7,8,9,12]);
            let shareP = pickPence(900, 5000);
            let spendP = pickPence(100, Math.min(2500, shareP-1));
            while(spendP>=shareP) spendP = pickPence(100, Math.min(2500, shareP-1));
            const totalP = shareP*people;
            const leftP = shareP - spendP;
            return Q([partMoney("n8_2c", `£${fmtNo00(totalP/100,2)} is shared equally between <b>${people}</b> people.<br>Each person then spends <b>£${fmtNo00(spendP/100,2)}</b>.<br>How much money does each person have left? Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, roundTo(leftP/100,2))]);
          }
        }

        if(sc===2){
          // Scenario 2 (Non-money: time): split into equal sections
          if(!isCalc){
            // Non-calculator 2 marks: ONE division by a TWO-digit divisor
            const sections = rng.choice([12,15,16,18,21,24,25,28]);
            const each = rng.int(6,40);
            const total = each*sections;
            return Q([partInteger("n8_2t", `A coach trip takes <b>${total}</b> minutes.<br>It is split into <b>${sections}</b> equal sections.<br>How long is <b>EACH</b> section? <span class="endmark">[2]</span>`, 2, each)]);
          }else{
            const sections = rng.choice([4,5,6,8,9,12]);
            let baseT = rng.int(150, 600); // tenths
            if(baseT%10===0) baseT+=3; // force decimal
            const base = baseT/10;
            const total = base*sections; // exact to 1 dp
            let brkC = rng.int(25, 525); // hundredths
            if(brkC%100===0) brkC+=11;
            const brk = brkC/100;
            const ans = roundTo(base + brk,2);
            return Q([partNumber("n8_2tc", `A coach trip takes <b>${fmt(total,2)}</b> minutes.<br>It is split into <b>${sections}</b> equal sections.<br>Then <b>${fmt(brk,2)}</b> minutes is added to <b>EACH</b> section for a break.<br>How long is <b>EACH</b> section now? Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, ans)]);
          }
        }

        // Scenario 3 (Non-money: packing): divide equally into bags
        if(!isCalc){
          // Non-calculator 2 marks: ONE division by a TWO-digit divisor
          const bags = rng.choice([12,15,16,18,21,24,25,28]);
          const each = rng.int(6,40);
          const total = each*bags;
          return Q([partInteger("n8_2p", `<b>${total}</b> stickers are packed equally into <b>${bags}</b> bags.<br>How many stickers are in each bag? <span class="endmark">[2]</span>`, 2, each)]);
        }else{
          const bags = rng.choice([4,5,6,7,8,9,12]);
          const people = rng.choice([2,3,4,5]);
          let eachC = rng.int(250, 2500); // hundredths of a gram: 2.50–25.00 g
          if(eachC%100===0) eachC+=17;
          const totalC = eachC*bags*people;
          return Q([partNumber("n8_2pc", `<b>${fmt(totalC/100,2)} g</b> of sweets are packed equally into <b>${bags}</b> bags.<br>Then each bag is shared equally between <b>${people}</b> people.<br>How many grams does each person get? Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, roundTo(eachC/100,2))]);
        }
      }


// -------------------- 3 MARK --------------------
      if(marksTotal===3){
        if(sc===1){
          // Scenario 1 (Money): 1-digit division, then 2-digit division
          if(!isCalc){
            const peopleA = rng.choice([3,4,5,6,7,8,9]);      // 1-digit divisor (1 mark)
            const peopleB = rng.choice([12,15,16,18,21,24,25,28]); // 2-digit divisor (2 marks)
            const eachB = rng.int(1,12);                       // £ each person in group B receives
            const share = peopleB*eachB;                       // amount each person in group A gets in part (a)
            const total = share*peopleA;

            return Q([
              partMoney("n8_3a", `<b>(a)</b> <b>£${total}</b> is shared equally between <b>${peopleA}</b> people. Work out how much each person gets. <span class="endmark">[1]</span>`, 1, share),
              partMoney("n8_3b", `<b>(b)</b> Each person then shares their money equally between <b>${peopleB}</b> people.<br>Work out how much <b>EACH</b> person gets. <span class="endmark">[2]</span>`, 2, eachB),
            ]);
          }else{
            const people = rng.choice([6,7,8,9,12]);

            const fracOpts = [
              {n:1,d:3, text:"one-third"},
              {n:1,d:4, text:"one-quarter"},
              {n:3,d:4, text:"three-quarters"},
              {n:1,d:5, text:"one-fifth"},
              {n:2,d:5, text:"two-fifths"},
            ];
            const frac = rng.choice(fracOpts);

            let shareP;
            do{ shareP = pickPence(800, 5000); }while(shareP%frac.d!==0);
            const totalP = shareP*people;
            const charityP = shareP*frac.n/frac.d;

            return Q([
              partMoney("n8_3ac", `<b>(a)</b> <b>£${fmtNo00(totalP/100,2)}</b> is shared equally between <b>${people}</b> people. Work out how much each person gets. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(shareP/100,2)),
              partMoney("n8_3bc", `<b>(b)</b> Each person gives <b>${frac.text}</b> of their share to charity.<br>Work out how much money each person gives. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, roundTo(charityP/100,2)),
            ]);

          }
        }

        if(sc===2){
          // Scenario 2 (Non-money: distance): 1-digit division, then 2-digit division
          if(!isCalc){
            const lapsOptions = [12,15,16,18,21,24,25,28]; // 2-digit divisor for part (b)
            let laps=12, lapLen=6, distB=72, speed=18, hoursB=4;
            let guard=0;

            while(guard<200){
              laps = rng.choice(lapsOptions);
              lapLen = rng.int(2,12);
              distB = laps*lapLen;

              // choose a speed (km/h) so that time is a whole number of hours
              const candidates = [];
              for(let s=12; s<=30; s++){
                if(distB % s === 0){
                  const hb = distB / s;
                  if(hb>=2 && hb<=8) candidates.push([s,hb]);
                }
              }
              if(candidates.length){
                const pick = rng.choice(candidates);
                speed = pick[0];
                hoursB = pick[1];
                break;
              }
              guard++;
            }

            if(guard>=200){
              // safe fallback
              laps = 12; lapLen = 8; distB = 96; speed = 24; hoursB = 4;
            }

            const hoursA = rng.choice([4,5,6,7,8]); // 1-digit divisor for part (a)
            const distA = speed*hoursA;

            return Q([
              partInteger("n8_3d_a", `<b>(a)</b> A cyclist travels <b>${distA} km</b> in <b>${hoursA}</b> hours. Work out the average speed in km per hour. <span class="endmark">[1]</span>`, 1, speed),
              partInteger("n8_3d_b", `<b>(b)</b> The cyclist cycles for <b>${hoursB}</b> hours at the same speed.<br>The distance is shared equally over <b>${laps}</b> identical laps.<br>Work out the length of <b>EACH</b> lap. <span class="endmark">[2]</span>`, 2, lapLen),
            ]);
          }else{
            // calculator version (decimals)
            let speedT = rng.int(120, 320); // tenths
            if(speedT%10===0) speedT+=3;
            const speed = speedT/10;

            const hoursA = rng.choice([5.5,6.5,7.5,8.5]);
            const distA = roundTo(speed*hoursA,2);

            const lapsOptions = [7,8,9,12];
            let hoursB, distBInt, laps, lapLen;
            let guard=0;
            while(guard<200){
              hoursB = rng.choice([2.4,2.8,3.2,3.6,4.0,4.5]);
              const distB = speed*hoursB;              // exact to 2 dp (0.1×0.1)
              distBInt = Math.round(distB*100);
              laps = rng.choice(lapsOptions);
              if(distBInt%laps===0){
                lapLen = (distBInt/laps)/100;
                break;
              }
              guard++;
            }
            if(guard>=200){
              hoursB = 3.6;
              const distB = speed*hoursB;
              distBInt = Math.round(distB*100);
              laps = 9;
              lapLen = (distBInt/laps)/100;
            }

            return Q([
              partNumber("n8_3dc_a", `<b>(a)</b> A cyclist travels <b>${fmt(distA,2)} km</b> in <b>${fmt(hoursA,2)}</b> hours. Work out the average speed in km per hour. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(speed,2)),
              partNumber("n8_3dc_b", `<b>(b)</b> The cyclist cycles for <b>${fmt(hoursB,2)}</b> hours at the same speed.<br>The distance is shared equally over <b>${laps}</b> identical laps.<br>Work out the length of <b>EACH</b> lap. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, roundTo(lapLen,2)),
            ]);
          }
        }

        // Scenario 3 (Non-money: food portions): 1-digit division, then 2-digit division
        if(!isCalc){
          const bowls = rng.choice([3,4,5,6,7,8,9]);                // 1-digit divisor (1 mark)
          const children = rng.choice([12,15,16,18,21,24,25,28]); // 2-digit divisor (2 marks)
          const eachChild = rng.int(1,12);
          const eachBowl = eachChild*children;
          const total = eachBowl*bowls;

          return Q([
            partInteger("n8_3f_a", `<b>(a)</b> <b>${total}</b> strawberries are shared equally into <b>${bowls}</b> bowls. How many strawberries are in each bowl? <span class="endmark">[1]</span>`, 1, eachBowl),
            partInteger("n8_3f_b", `<b>(b)</b> Each bowl is then shared equally between <b>${children}</b> children.<br>How many strawberries does <b>EACH</b> child get? <span class="endmark">[2]</span>`, 2, eachChild),
          ]);
        }else{
          const jugs = rng.choice([6,7,8,9]);
          const cups = rng.choice([5,6,7,8,9]);
          const eachCupC = rng.int(5, 50); // 0.05–0.50 L in hundredths
          const eachJugC = eachCupC*cups;  // hundredths
          const totalC = eachJugC*jugs;    // hundredths
          return Q([
            partNumber("n8_3fc_a", `<b>(a)</b> <b>${fmtNo00(totalC/100,2)} litres</b> of juice are shared equally into <b>${jugs}</b> jugs. How many litres are in each jug? Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(eachJugC/100,2)),
            partNumber("n8_3fc_b", `<b>(b)</b> Each jug is then poured equally into <b>${cups}</b> cups.<br>How many litres are in <b>EACH</b> cup? Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, roundTo(eachCupC/100,2)),
          ]);
        }
      }


// -------------------- 4 MARK (TABLE) --------------------
      if(marksTotal===4){
        if(sc===1){
          // Scenario 1 (Money) — table
          if(!isCalc){
            const ticket = rng.int(7,15);
            const drink = rng.int(2,6);
            const popcorn = rng.int(3,7);
            const sweets = rng.int(2,6);

            const peopleShareA = 3; // share first item cost
            const peopleShareB = 6; // share leftover

            const items = [
              {name:"Ticket", plural:"tickets", cost:ticket},
              {name:"Drink", plural:"drinks", cost:drink},
              {name:"Popcorn", plural:"popcorns", cost:popcorn},
              {name:"Sweets", plural:"sweets", cost:sweets},
            ];

            // Randomise which item is used in (a) and which item is used in (b)
            const pick = rng.shuffle(items).slice(0,2);
            const shareItem = pick[0];
            const spendItem = pick[1];

            const shareCost = 6*shareItem.cost;          // total spend for part (a)
            const eachA = shareCost/peopleShareA;        // exact integer (6/3 = 2)

            // Construct a budget so that "as much as possible" on spendItem leaves a remainder divisible by 6
            const k = rng.int(8,16); // number of spendItem bought
            let remainderOptions = [];
            for(let r=0; r<spendItem.cost; r++){
              if(r%peopleShareB===0) remainderOptions.push(r);
            }
            // Prefer a non-zero remainder when possible
            const nonZero = remainderOptions.filter(r=>r!==0);
            const rem = rng.choice((nonZero.length?nonZero:remainderOptions.length?remainderOptions:[0]));

            const budget = shareCost + spendItem.cost*k + rem;
            const eachB = rem/peopleShareB;

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>Ticket</td><td class="num">£${ticket}</td></tr>
                <tr><td>Drink</td><td class="num">£${drink}</td></tr>
                <tr><td>Popcorn</td><td class="num">£${popcorn}</td></tr>
                <tr><td>Sweets</td><td class="num">£${sweets}</td></tr>
              </table>`;

            return Q([
              partMoney("n8_4a", `A group has <b>£${budget}</b> to spend. Prices are shown below.${table}<br><b>(a)</b> The group buys <b>6</b> ${shareItem.plural} and shares the cost equally between <b>${peopleShareA}</b> people.<br>Work out how much <b>EACH</b> person pays. <span class="endmark">[1]</span>`, 1, eachA),
              partMoney("n8_4b", `<b>(b)</b> The group then spends as much of the remaining money as possible on ${spendItem.plural}.<br>The money left after buying the ${spendItem.plural} is shared equally between <b>${peopleShareB}</b> people.<br>Work out how much <b>EACH</b> person gets. <span class="endmark">[3]</span>`, 3, eachB),
            ]);
          }else{
            const ticketP = pickPence(750, 1500);
            const drinkP = pickPence(250, 700);
            const popcornP = pickPence(300, 800);
            const sweetsP = pickPence(200, 650);

            const peopleShareA = 3;
            const peopleShareB = 6;

            const items = [
              {name:"Ticket", plural:"tickets", cost:ticketP},
              {name:"Drink", plural:"drinks", cost:drinkP},
              {name:"Popcorn", plural:"popcorns", cost:popcornP},
              {name:"Sweets", plural:"sweets", cost:sweetsP},
            ];

            const pick = rng.shuffle(items).slice(0,2);
            const shareItem = pick[0];
            const spendItem = pick[1];

            const shareCostP = 6*shareItem.cost;
            const eachA = roundTo((shareCostP/peopleShareA)/100,2);

            const k = rng.int(8,16);
            let remainderOptions = [];
            for(let r=0; r<spendItem.cost; r++){
              if(r%peopleShareB===0) remainderOptions.push(r);
            }
            const nonZero = remainderOptions.filter(r=>r!==0);
            const remP = rng.choice((nonZero.length?nonZero:remainderOptions.length?remainderOptions:[0]));

            const budgetP = shareCostP + spendItem.cost*k + remP;
            const eachB = roundTo((remP/peopleShareB)/100,2);

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>Ticket</td><td class="num">£${(ticketP/100).toFixed(2)}</td></tr>
                <tr><td>Drink</td><td class="num">£${(drinkP/100).toFixed(2)}</td></tr>
                <tr><td>Popcorn</td><td class="num">£${(popcornP/100).toFixed(2)}</td></tr>
                <tr><td>Sweets</td><td class="num">£${(sweetsP/100).toFixed(2)}</td></tr>
              </table>`;

            return Q([
              partMoney("n8_4ac", `A group has <b>£${fmtNo00(budgetP/100,2)}</b> to spend. Prices are shown below.${table}<br><b>(a)</b> The group buys <b>6</b> ${shareItem.plural} and shares the cost equally between <b>${peopleShareA}</b> people.<br>Work out how much <b>EACH</b> person pays. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, eachA),
              partMoney("n8_4bc", `<b>(b)</b> The group then spends as much of the remaining money as possible on ${spendItem.plural}.<br>The money left after buying the ${spendItem.plural} is shared equally between <b>${peopleShareB}</b> people.<br>Work out how much <b>EACH</b> person gets. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, eachB),
            ]);
          }
        }

        if(sc===2){
          // Scenario 2 (Non-money: compost bags) — table
          if(!isCalc){
            // build a simple increasing mass table (whole numbers)
            const small = rng.choice([1,2,3]);
            const medium = small + rng.choice([1,1,2]);
            const large = medium + rng.choice([1,1,2]);
            const xlarge = large + rng.choice([1,1,2]);

            // (a) total mass shared equally
            const groups = rng.choice([4,5,6,7,8]);
            const eachKg = rng.int(2,8);
            const totalKg = eachKg*groups;

            // (b) pick two bag sizes at random (and share total bags equally)
            const bagTypes = [
              {label:"extra large", mass:xlarge},
              {label:"large", mass:large},
              {label:"medium", mass:medium},
              {label:"small", mass:small},
            ];
            const chosenBags = rng.shuffle(bagTypes).slice(0,2);
            const bag1 = chosenBags[0];
            const bag2 = chosenBags[1];

            let b1 = rng.int(2,10);
            let b2 = rng.int(2,10);
            while((b1+b2)%4!==0){
              b1 = rng.int(2,10);
              b2 = rng.int(2,10);
            }
            const req1 = (b1-1)*bag1.mass + rng.int(1,bag1.mass);
            const req2 = (b2-1)*bag2.mass + rng.int(1,bag2.mass);
            const ansBags = (b1+b2)/4;

            const table = `
              <table class="qtable">
                <tr><th>Bag size</th><th class="num">Mass per bag (kg)</th></tr>
                <tr><td>Extra large</td><td class="num">${xlarge}</td></tr>
                <tr><td>Large</td><td class="num">${large}</td></tr>
                <tr><td>Medium</td><td class="num">${medium}</td></tr>
                <tr><td>Small</td><td class="num">${small}</td></tr>
              </table>`;

            return Q([
              partInteger("n8_4p_a", `Compost is sold in bags. The mass of each bag is shown.${table}<br><b>(a)</b> <b>${totalKg} kg</b> of compost is shared equally between <b>${groups}</b> groups.<br>Work out the mass <b>EACH</b> group gets. <span class="endmark">[1]</span>`, 1, eachKg),
              partInteger("n8_4p_b", `<b>(b)</b> A garden needs <b>${req1} kg</b> of compost in ${bag1.label} bags and <b>${req2} kg</b> in ${bag2.label} bags.<br>Bags must be bought as whole bags.<br>The <b>TOTAL</b> number of bags bought is shared equally between <b>4</b> gardeners.<br>Work out how many bags <b>EACH</b> gardener receives. <span class="endmark">[3]</span>`, 3, ansBags),
            ]);
          }else{
            // masses with decimals (hundredths kg)
            let masses = [];
            while(masses.length<4){
              const v = pickPence(80, 450); // 0.80–4.50 kg
              if(!masses.includes(v)) masses.push(v);
            }
            masses.sort((a,b)=>a-b);
            const [smallC, mediumC, largeC, xlargeC] = masses;

            const groups = rng.choice([4,5,6,7,8]);
            let eachC = rng.int(150, 650);
            if(eachC%100===0) eachC+=13;
            const totalC = eachC*groups;

            const bagTypes = [
              {label:"extra large", mass:xlargeC},
              {label:"large", mass:largeC},
              {label:"medium", mass:mediumC},
              {label:"small", mass:smallC},
            ];
            const chosenBags = rng.shuffle(bagTypes).slice(0,2);
            const bag1 = chosenBags[0];
            const bag2 = chosenBags[1];

            let b1 = rng.int(2,10);
            let b2 = rng.int(2,10);
            while((b1+b2)%4!==0){
              b1 = rng.int(2,10);
              b2 = rng.int(2,10);
            }
            const req1C = (b1-1)*bag1.mass + rng.int(1,bag1.mass);
            const req2C = (b2-1)*bag2.mass + rng.int(1,bag2.mass);
            const ansBags = (b1+b2)/4;

            const table = `
              <table class="qtable">
                <tr><th>Bag size</th><th class="num">Mass per bag (kg)</th></tr>
                <tr><td>Extra large</td><td class="num">${(xlargeC/100).toFixed(2)}</td></tr>
                <tr><td>Large</td><td class="num">${(largeC/100).toFixed(2)}</td></tr>
                <tr><td>Medium</td><td class="num">${(mediumC/100).toFixed(2)}</td></tr>
                <tr><td>Small</td><td class="num">${(smallC/100).toFixed(2)}</td></tr>
              </table>`;

            return Q([
              partNumber("n8_4pc_a", `Compost is sold in bags. The mass of each bag is shown.${table}<br><b>(a)</b> <b>${fmtNo00(totalC/100,2)} kg</b> of compost is shared equally between <b>${groups}</b> groups.<br>Work out the mass <b>EACH</b> group gets. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, roundTo(eachC/100,2)),
              partInteger("n8_4pc_b", `<b>(b)</b> A garden needs <b>${fmtNo00(req1C/100,2)} kg</b> of compost in ${bag1.label} bags and <b>${fmtNo00(req2C/100,2)} kg</b> in ${bag2.label} bags.<br>Bags must be bought as whole bags.<br>The <b>TOTAL</b> number of bags bought is shared equally between <b>4</b> gardeners.<br>Work out how many bags <b>EACH</b> gardener receives. <span class="endmark">[3]</span>`, 3, ansBags),
            ]);
          }
        }

        // Scenario 3 (Non-money: fuel planning) — table
        if(!isCalc){
          const city = rng.int(5,9);
          const motorway = rng.int(10,14);
          const rural = rng.int(7,11);
          const short = rng.int(4,7);

          const tripTypes = [
            {label:"City", word:"city", fuel:city},
            {label:"Motorway", word:"motorway", fuel:motorway},
            {label:"Rural", word:"rural", fuel:rural},
            {label:"Short", word:"short", fuel:short},
          ];

          // (a) choose a random trip type to ask about
          const tripA = rng.choice(tripTypes);
          const tripsA = rng.int(4,10);
          const usedA = tripsA*tripA.fuel;

          // (b) choose a different trip type for the remaining fuel, and randomise the two "fixed" trip types
          const tripB = rng.choice(tripTypes.filter(t=>t.word!==tripA.word));
          const others = tripTypes.filter(t=>t.word!==tripB.word);
          const fixed = rng.shuffle(others).slice(0,2); // two different trip types, not tripB

          const fixed1 = fixed[0];
          const fixed2 = fixed[1];
          const fixedCount1 = 5;
          const fixedCount2 = 3;

          const tripsB = rng.int(6,16);
          const totalFuel = fixedCount1*fixed1.fuel + fixedCount2*fixed2.fuel + tripsB*tripB.fuel;

          const table = `
            <table class="qtable">
              <tr><th>Trip type</th><th class="num">Fuel used (litres)</th></tr>
              <tr><td>City</td><td class="num">${city}</td></tr>
              <tr><td>Motorway</td><td class="num">${motorway}</td></tr>
              <tr><td>Rural</td><td class="num">${rural}</td></tr>
              <tr><td>Short</td><td class="num">${short}</td></tr>
            </table>`;

          return Q([
            partInteger("n8_4f_a", `Fuel used per trip is shown.${table}<br><b>(a)</b> <b>${usedA}</b> litres of fuel are used on ${tripA.word} trips only.<br>How many ${tripA.word} trips is that? <span class="endmark">[1]</span>`, 1, tripsA),
            partInteger("n8_4f_b", `<b>(b)</b> A driver has <b>${totalFuel}</b> litres of fuel available for the day.<br>They make <b>${fixedCount1}</b> ${fixed1.word} trips and <b>${fixedCount2}</b> ${fixed2.word} trips.<br>The fuel left is used for ${tripB.word} trips only.<br>Work out how many ${tripB.word} trips can be made. <span class="endmark">[3]</span>`, 3, tripsB),
          ]);
        }else{
          // use hundredths of litres to keep exact
          const cityC = pickPence(650, 900);       // 6.50–9.00 L
          const motorwayC = pickPence(1050, 1500); // 10.50–15.00 L
          const ruralC = pickPence(750, 1250);     // 7.50–12.50 L
          const shortC = pickPence(450, 850);      // 4.50–8.50 L

          const tripTypes = [
            {label:"City", word:"city", fuel:cityC},
            {label:"Motorway", word:"motorway", fuel:motorwayC},
            {label:"Rural", word:"rural", fuel:ruralC},
            {label:"Short", word:"short", fuel:shortC},
          ];

          const tripA = rng.choice(tripTypes);
          const tripsA = rng.int(4,10);
          const usedAC = tripsA*tripA.fuel;

          const tripB = rng.choice(tripTypes.filter(t=>t.word!==tripA.word));
          const others = tripTypes.filter(t=>t.word!==tripB.word);
          const fixed = rng.shuffle(others).slice(0,2);

          const fixed1 = fixed[0];
          const fixed2 = fixed[1];
          const fixedCount1 = 5;
          const fixedCount2 = 3;

          const tripsB = rng.int(6,16);
          const totalFuelC = fixedCount1*fixed1.fuel + fixedCount2*fixed2.fuel + tripsB*tripB.fuel;

          const table = `
            <table class="qtable">
              <tr><th>Trip type</th><th class="num">Fuel used (litres)</th></tr>
              <tr><td>City</td><td class="num">${(cityC/100).toFixed(2)}</td></tr>
              <tr><td>Motorway</td><td class="num">${(motorwayC/100).toFixed(2)}</td></tr>
              <tr><td>Rural</td><td class="num">${(ruralC/100).toFixed(2)}</td></tr>
              <tr><td>Short</td><td class="num">${(shortC/100).toFixed(2)}</td></tr>
            </table>`;

          return Q([
            partInteger("n8_4fc_a", `Fuel used per trip is shown.${table}<br><b>(a)</b> <b>${fmtNo00(usedAC/100,2)}</b> litres of fuel are used on ${tripA.word} trips only.<br>How many ${tripA.word} trips is that? <span class="endmark">[1]</span>`, 1, tripsA),
            partInteger("n8_4fc_b", `<b>(b)</b> A driver has <b>${fmtNo00(totalFuelC/100,2)}</b> litres of fuel available for the day.<br>They make <b>${fixedCount1}</b> ${fixed1.word} trips and <b>${fixedCount2}</b> ${fixed2.word} trips.<br>The fuel left is used for ${tripB.word} trips only.<br>Work out how many ${tripB.word} trips can be made. <span class="endmark">[3]</span>`, 3, tripsB),
          ]);
        }
      }

      // -------------------- 5 MARK (TABLE) --------------------
      if(marksTotal===5){
        if(sc===1){
          // Scenario 1 (Money: split + change then split) — table
          if(!isCalc){
            const pay = 200;

            let meal, drink, dessert, side;
            let aItem, bItem1, bItem2;
            let qB1, qB2;
            let totalCost, change;

            let guard=0;
            do{
              meal = rng.int(10,18);
              drink = rng.int(2,6);
              dessert = rng.int(3,8);
              side = rng.int(2,6); // kept for table completeness

              const items = [
                {name:"Meal", plural:"meals", cost:meal},
                {name:"Drink", plural:"drinks", cost:drink},
                {name:"Dessert", plural:"desserts", cost:dessert},
                {name:"Side", plural:"sides", cost:side},
              ];

              const chosen = rng.shuffle(items);
              aItem = chosen[0];

              const bPair = rng.shuffle(chosen.slice(1,3));
              const qtyAssign = rng.shuffle([6,3]);
              bItem1 = bPair[0]; qB1 = qtyAssign[0];
              bItem2 = bPair[1]; qB2 = qtyAssign[1];

              totalCost = 8*aItem.cost + qB1*bItem1.cost + qB2*bItem2.cost;
              change = pay - totalCost;

              guard++;
            }while((change<=0 || change%5!==0) && guard<500);

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>Meal</td><td class="num">£${meal}</td></tr>
                <tr><td>Drink</td><td class="num">£${drink}</td></tr>
                <tr><td>Dessert</td><td class="num">£${dessert}</td></tr>
                <tr><td>Side</td><td class="num">£${side}</td></tr>
              </table>`;

            const eachPays = (8*aItem.cost)/4; // = 2 × item cost
            const eachGets = change/5;

            return Q([
              partMoney("n8_5m_a", `A café has a menu.${table}<br><b>(a)</b> A group buys <b>8</b> ${aItem.plural}.<br>They share the cost equally between <b>4</b> people.<br>Work out how much <b>EACH</b> person pays. <span class="endmark">[2]</span>`, 2, eachPays),
              partMoney("n8_5m_b", `<b>(b)</b> The group also buys <b>${qB1}</b> ${bItem1.plural} and <b>${qB2}</b> ${bItem2.plural}.<br>They pay with <b>£${pay}</b>.<br>The change is shared equally between <b>5</b> people.<br>Work out how much <b>EACH</b> person gets. <span class="endmark">[3]</span>`, 3, eachGets),
            ]);
          }else{
            const payP = 20000;

            let mealP, drinkP, dessertP, sideP;
            let aItem, bItem1, bItem2;
            let qB1, qB2;
            let totalCostP, changeP;

            let guard=0;
            do{
              mealP = pickPence(1000, 1899);
              drinkP = pickPence(200, 699);
              dessertP = pickPence(300, 899);
              sideP = pickPence(200, 699);

              const items = [
                {name:"Meal", plural:"meals", cost:mealP},
                {name:"Drink", plural:"drinks", cost:drinkP},
                {name:"Dessert", plural:"desserts", cost:dessertP},
                {name:"Side", plural:"sides", cost:sideP},
              ];

              const chosen = rng.shuffle(items);
              aItem = chosen[0];

              const bPair = rng.shuffle(chosen.slice(1,3));
              const qtyAssign = rng.shuffle([6,3]);
              bItem1 = bPair[0]; qB1 = qtyAssign[0];
              bItem2 = bPair[1]; qB2 = qtyAssign[1];

              totalCostP = 8*aItem.cost + qB1*bItem1.cost + qB2*bItem2.cost;
              changeP = payP - totalCostP;

              guard++;
            }while((changeP<=0 || changeP%500!==0) && guard<800); // divisible by 5 people (in pence)

            const table = `
              <table class="qtable">
                <tr><th>Item</th><th class="num">Cost</th></tr>
                <tr><td>Meal</td><td class="num">£${(mealP/100).toFixed(2)}</td></tr>
                <tr><td>Drink</td><td class="num">£${(drinkP/100).toFixed(2)}</td></tr>
                <tr><td>Dessert</td><td class="num">£${(dessertP/100).toFixed(2)}</td></tr>
                <tr><td>Side</td><td class="num">£${(sideP/100).toFixed(2)}</td></tr>
              </table>`;

            const eachPays = roundTo(((8*aItem.cost)/4)/100,2);
            const eachGets = roundTo((changeP/5)/100,2);

            return Q([
              partMoney("n8_5mc_a", `A café has a menu.${table}<br><b>(a)</b> A group buys <b>8</b> ${aItem.plural}.<br>They share the cost equally between <b>4</b> people.<br>Work out how much <b>EACH</b> person pays. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, eachPays),
              partMoney("n8_5mc_b", `<b>(b)</b> The group also buys <b>${qB1}</b> ${bItem1.plural} and <b>${qB2}</b> ${bItem2.plural}.<br>They pay with <b>£${(payP/100).toFixed(2)}</b>.<br>The change is shared equally between <b>5</b> people.<br>Work out how much <b>EACH</b> person gets. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, eachGets),
            ]);
          }
        }

        if(sc===2){
          // Scenario 2 (Non-money: compost bags — staged) — table
          if(rng.float() < 0.5){
            const gardeners = 4;

            if(!isCalc){
              // Choose bag masses so that one bag size stays single-digit (for a 1-mark division)
              // and one bag size stays two-digit (for a 2-mark division).
              const small = rng.choice([4,5,6,7,8]);
              const medium = rng.int(small+1, 9);
              const large = rng.choice([12,13,14,15,16,18]);
              const xlarge = large + rng.choice([2,3,4,5]);

              const bigChoices = [
                {label:"large", display:"Large", mass:large},
                {label:"extra large", display:"Extra large", mass:xlarge},
              ];
              const smallChoices = [
                {label:"small", display:"Small", mass:small},
                {label:"medium", display:"Medium", mass:medium},
              ];

              const bagA = rng.choice(bigChoices);   // used in part (a)
              const bagB = rng.choice(smallChoices); // used in part (b)

              // Choose quantities so the total mass can be shared equally
              let nA = rng.int(3,9);
              let nB = rng.int(2,9);
              let totalMass = nA*bagA.mass + nB*bagB.mass;

              let guard = 0;
              while(totalMass % gardeners !== 0 && guard < 250){
                nA = rng.int(3,9);
                nB = rng.int(2,9);
                totalMass = nA*bagA.mass + nB*bagB.mass;
                guard++;
              }

              const reqA = nA*bagA.mass;
              const reqB = nB*bagB.mass;
              const eachGets = totalMass / gardeners;

              const table = `
                <table class="qtable">
                  <tr><th>Bag size</th><th class="num">Mass (kg)</th></tr>
                  <tr><td>Small</td><td class="num">${small}</td></tr>
                  <tr><td>Medium</td><td class="num">${medium}</td></tr>
                  <tr><td>Large</td><td class="num">${large}</td></tr>
                  <tr><td>Extra large</td><td class="num">${xlarge}</td></tr>
                </table>`;

              return Q([
                partInteger("n8_comp5_a", `Compost is sold in bags. The mass of each bag is shown.${table}<br><b>(a)</b> A garden needs <b>${reqA} kg</b> of compost in <b>${bagA.label}</b> bags. Bags must be bought as whole bags.<br>Work out how many <b>${bagA.label}</b> bags are needed. <span class="endmark">[2]</span>`, 2, nA),
                partInteger("n8_comp5_b", `<b>(b)</b> The garden also needs <b>${reqB} kg</b> of compost in <b>${bagB.label}</b> bags. Bags must be bought as whole bags.<br>Work out how many <b>${bagB.label}</b> bags are needed. <span class="endmark">[1]</span>`, 1, nB),
                partInteger("n8_comp5_c", `<b>(c)</b> Work out the total mass of compost that will be bought (in kg). <span class="endmark">[1]</span>`, 1, totalMass),
                partInteger("n8_comp5_d", `<b>(d)</b> The total mass of compost is shared equally between <b>${gardeners}</b> gardeners.<br>Work out the mass of compost each gardener gets (in kg). <span class="endmark">[1]</span>`, 1, eachGets),
              ]);
            } else {
              const small = decDp(3.50, 8.90, 2);
              const medium = decDp(small+0.10, 9.90, 2);
              const large = decDp(11.50, 18.50, 2);
              const xlarge = decDp(large+0.50, large+3.50, 2);

              const bigChoices = [
                {label:"large", display:"Large", mass:large},
                {label:"extra large", display:"Extra large", mass:xlarge},
              ];
              const smallChoices = [
                {label:"small", display:"Small", mass:small},
                {label:"medium", display:"Medium", mass:medium},
              ];

              const bagA = rng.choice(bigChoices);
              const bagB = rng.choice(smallChoices);

              const nA = rng.int(3,9);
              const nB = rng.int(2,9);

              const reqA = roundTo(nA*bagA.mass, 2);
              const reqB = roundTo(nB*bagB.mass, 2);

              const totalMassRaw = reqA + reqB;
              const totalMass = roundTo(totalMassRaw, 2);
              const eachGets = roundTo(totalMassRaw / gardeners, 2);

              const table = `
                <table class="qtable">
                  <tr><th>Bag size</th><th class="num">Mass (kg)</th></tr>
                  <tr><td>Small</td><td class="num">${small.toFixed(2)}</td></tr>
                  <tr><td>Medium</td><td class="num">${medium.toFixed(2)}</td></tr>
                  <tr><td>Large</td><td class="num">${large.toFixed(2)}</td></tr>
                  <tr><td>Extra large</td><td class="num">${xlarge.toFixed(2)}</td></tr>
                </table>`;

              return Q([
                partInteger("n8_comp5c_a", `Compost is sold in bags. The mass of each bag is shown.${table}<br><b>(a)</b> A garden needs <b>${reqA.toFixed(2)} kg</b> of compost in <b>${bagA.label}</b> bags. Bags must be bought as whole bags.<br>Work out how many <b>${bagA.label}</b> bags are needed. <span class="endmark">[2]</span>`, 2, nA),
                partInteger("n8_comp5c_b", `<b>(b)</b> The garden also needs <b>${reqB.toFixed(2)} kg</b> of compost in <b>${bagB.label}</b> bags. Bags must be bought as whole bags.<br>Work out how many <b>${bagB.label}</b> bags are needed. <span class="endmark">[1]</span>`, 1, nB),
                partNumber("n8_comp5c_c", `<b>(c)</b> Work out the total mass of compost that will be bought (in kg). Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, totalMass),
                partNumber("n8_comp5c_d", `<b>(d)</b> The total mass of compost is shared equally between <b>${gardeners}</b> gardeners.<br>Work out the mass of compost each gardener gets (in kg). Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`, 1, eachGets),
              ]);
            }

          }

          // Scenario 2 (Non-money: volume filling + sharing) — table
          const jugs = isCalc ? rng.choice([6,7,8,9]) : rng.choice([8,9,12]);
          const cups = isCalc ? rng.choice([6,7,8,9]) : rng.choice([5,6,7,8,9]);

          if(!isCalc){
            // container volumes (whole numbers) — randomised so ANY container can be the smallest
            const vols = [];
            while(vols.length<4){
              const v = rng.int(3,15);
              if(!vols.includes(v)) vols.push(v);
            }
            const names = ["Container A","Container B","Container C","Container D"];
            const shuffledVols = rng.shuffle(vols);
            const list = names.map((name,i)=>({name, v:shuffledVols[i]}));

            // smallest
            let minObj = list[0];
            for(const o of list){ if(o.v<minObj.v) minObj=o; }
            const vMin = minObj.v;

            const denom = jugs*cups;
            const step = denom / gcd(vMin, denom);
            const fullCount = rng.int(6,14)*step;
            const remainder = rng.int(0, vMin-1);
            const totalWater = fullCount*vMin + remainder;

            const usedWater = fullCount*vMin;
            const eachCup = usedWater/denom;

            const table = `
              <table class="qtable">
                <tr><th>Container type</th><th class="num">Volume (litres)</th></tr>
                ${list.map(o=>`<tr><td>${o.name}</td><td class="num">${o.v}</td></tr>`).join("")}
              </table>`;

            return Q([
              partPair("n8_5v_a", `Drinks are supplied in containers.${table}<br><b>(a)</b> A sports day has <b>${totalWater}</b> litres of water.<br>They pour the water into the smallest volume container.<br>Work out how many <b>FULL</b> containers they can fill and how many litres are left over. <span class="endmark">[2]</span>`, 2, [fullCount, remainder], {placeholders:["containers","litres left over"]}),
              partNumber("n8_5v_b", `<b>(b)</b> Only the water in the <b>FULL</b> containers is used for drinks.<br>This water is shared equally into <b>${jugs}</b> jugs.<br>Then each jug is poured equally into <b>${cups}</b> cups.<br>Work out the volume of water in <b>EACH</b> cup. <span class="endmark">[3]</span>`, 3, eachCup),
            ]);
          }else{
            // calculator version — hundredths of litres (randomised so ANY container can be the smallest)
            let vols = [];
            while(vols.length<4){
              const v = pickPence(250, 1400); // 2.50–14.00
              if(!vols.includes(v)) vols.push(v);
            }
            vols = rng.shuffle(vols);
            const names = ["Container A","Container B","Container C","Container D"];
            const list = names.map((name,i)=>({name, v: vols[i]}));

            let minObj = list[0];
            for(const o of list){ if(o.v<minObj.v) minObj=o; }
            const vMin = minObj.v; // in hundredths of a litre

            const denom = jugs*cups;
            const step = denom / gcd(vMin, denom);
            const fullCount = rng.int(6,14)*step;
            const remainder = rng.int(0, vMin-1);
            const totalWater = fullCount*vMin + remainder;

            const usedWater = fullCount*vMin;
            const eachCup = roundTo((usedWater/denom)/100,2);
            const leftover = roundTo(remainder/100,2);

            const table = `
              <table class="qtable">
                <tr><th>Container type</th><th class="num">Volume (litres)</th></tr>
                ${list.map(o=>`<tr><td>${o.name}</td><td class="num">${(o.v/100).toFixed(2)}</td></tr>`).join("")}
              </table>`;

            return Q([
              partPair("n8_5vc_a", `Drinks are supplied in containers.${table}<br><b>(a)</b> A sports day has <b>${fmtNo00(totalWater/100,2)}</b> litres of water.<br>They pour the water into the smallest volume container.<br>Work out how many <b>FULL</b> containers they can fill and how many litres are left over. Round any decimal answers to <b>2</b> decimal places. <span class="endmark">[2]</span>`, 2, [fullCount, leftover], {placeholders:["containers","litres left over"]}),
              partNumber("n8_5vc_b", `<b>(b)</b> Only the water in the <b>FULL</b> containers is used for drinks.<br>This water is shared equally into <b>${jugs}</b> jugs.<br>Then each jug is poured equally into <b>${cups}</b> cups.<br>Work out the volume of water in <b>EACH</b> cup. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, eachCup),
            ]);
          }
        }

        // Scenario 3 (Non-money: sessions + staffing split) — table
        if(!isCalc){
          const staff = 7;

          const labels = {
            swim:{row:"Swimming", plural:"swimming sessions"},
            fitness:{row:"Fitness class", plural:"fitness classes"},
            yoga:{row:"Yoga", plural:"yoga sessions"},
            bad:{row:"Badminton", plural:"badminton sessions"},
          };

          const opts = {
            swim:[40,45,50,55],
            fitness:[55,60,65],
            yoga:[35,38,42,45],
            bad:[45,50,55],
          };

          // Pick the two session types used in part (b) (and randomise the order/quantities)
          const sessionKeys = ["swim","fitness","yoga","bad"];
          const bKeys = rng.shuffle(sessionKeys).slice(0,2);
          const counts = rng.shuffle([8,6]);
          const bKey1 = bKeys[0], bKey2 = bKeys[1];
          const c1 = counts[0], c2 = counts[1];

          // Choose durations, then tweak the ones used in (b) until the total time shares equally between staff
          let swim = rng.choice(opts.swim);
          let fitness = rng.choice(opts.fitness);
          let yoga = rng.choice(opts.yoga);
          let bad = rng.choice(opts.bad);

          const getMins = (k)=> (k==="swim")?swim : (k==="fitness")?fitness : (k==="yoga")?yoga : bad;
          const resample = (k)=>{
            if(k==="swim") swim = rng.choice(opts.swim);
            else if(k==="fitness") fitness = rng.choice(opts.fitness);
            else if(k==="yoga") yoga = rng.choice(opts.yoga);
            else bad = rng.choice(opts.bad);
          };

          let totalTime = c1*getMins(bKey1) + c2*getMins(bKey2);
          let guard=0;
          while(totalTime%staff!==0 && guard<600){
            resample(bKey1);
            resample(bKey2);
            totalTime = c1*getMins(bKey1) + c2*getMins(bKey2);
            guard++;
          }
          const eachStaff = totalTime/staff;

          // (a) pick a (possibly different) session type for the coach question
          const aKey = rng.choice(sessionKeys);
          const aSessions = rng.int(5,10);
          const aMins = getMins(aKey);
          const remainder = rng.int(0, aMins-1);
          const available = aMins*aSessions + remainder;

          const table = `
            <table class="qtable">
              <tr><th>Session type</th><th class="num">Minutes per session</th></tr>
              <tr><td>Swimming</td><td class="num">${swim}</td></tr>
              <tr><td>Fitness class</td><td class="num">${fitness}</td></tr>
              <tr><td>Yoga</td><td class="num">${yoga}</td></tr>
              <tr><td>Badminton</td><td class="num">${bad}</td></tr>
            </table>`;

          return Q([
            partInteger("n8_5s_a", `A leisure centre runs sessions.${table}<br><b>(a)</b> A coach has <b>${available}</b> minutes available.<br>How many whole ${labels[aKey].plural} can be run? <span class="endmark">[2]</span>`, 2, aSessions),
            partInteger("n8_5s_b", `<b>(b)</b> In one day the centre runs <b>${c1}</b> ${labels[bKey1].plural} and <b>${c2}</b> ${labels[bKey2].plural}.<br>The <b>TOTAL</b> session time is shared equally between <b>${staff}</b> staff to supervise.<br>Work out how many minutes <b>EACH</b> staff member supervises. <span class="endmark">[3]</span>`, 3, eachStaff),
          ]);
        }else{
          // calculator version — hundredths of minutes
          const staff = 7;

          const labels = {
            swim:{row:"Swimming", plural:"swimming sessions"},
            fitness:{row:"Fitness class", plural:"fitness classes"},
            yoga:{row:"Yoga", plural:"yoga sessions"},
            bad:{row:"Badminton", plural:"badminton sessions"},
          };

          const sessionKeys = ["swim","fitness","yoga","bad"];
          const bKeys = rng.shuffle(sessionKeys).slice(0,2);
          const counts = rng.shuffle([8,6]);
          const bKey1 = bKeys[0], bKey2 = bKeys[1];
          const c1 = counts[0], c2 = counts[1];

          const sample = (k)=>{
            if(k==="swim") return pickPence(4000, 6500);    // 40.00–65.00
            if(k==="fitness") return pickPence(5500, 7500); // 55.00–75.00
            if(k==="yoga") return pickPence(3500, 5000);    // 35.00–50.00
            return pickPence(4500, 6500);                   // badminton 45.00–65.00
          };

          let swimC = sample("swim");
          let fitnessC = sample("fitness");
          let yogaC = sample("yoga");
          let badC = sample("bad");

          const getMins = (k)=> (k==="swim")?swimC : (k==="fitness")?fitnessC : (k==="yoga")?yogaC : badC;
          const resample = (k)=>{
            const v = sample(k);
            if(k==="swim") swimC = v;
            else if(k==="fitness") fitnessC = v;
            else if(k==="yoga") yogaC = v;
            else badC = v;
          };

          let totalTimeC = c1*getMins(bKey1) + c2*getMins(bKey2);
          let guard=0;
          while(totalTimeC%staff!==0 && guard<900){
            resample(bKey1);
            resample(bKey2);
            totalTimeC = c1*getMins(bKey1) + c2*getMins(bKey2);
            guard++;
          }
          const eachStaff = roundTo((totalTimeC/staff)/100,2);

          const aKey = rng.choice(sessionKeys);
          const aSessions = rng.int(5,10);
          const aMinsC = getMins(aKey);
          const remainder = rng.int(0, aMinsC-1);
          const availableC = aMinsC*aSessions + remainder;

          const table = `
            <table class="qtable">
              <tr><th>Session type</th><th class="num">Minutes per session</th></tr>
              <tr><td>Swimming</td><td class="num">${(swimC/100).toFixed(2)}</td></tr>
              <tr><td>Fitness class</td><td class="num">${(fitnessC/100).toFixed(2)}</td></tr>
              <tr><td>Yoga</td><td class="num">${(yogaC/100).toFixed(2)}</td></tr>
              <tr><td>Badminton</td><td class="num">${(badC/100).toFixed(2)}</td></tr>
            </table>`;

          return Q([
            partInteger("n8_5sc_a", `A leisure centre runs sessions.${table}<br><b>(a)</b> A coach has <b>${fmtNo00(availableC/100,2)}</b> minutes available.<br>How many whole ${labels[aKey].plural} can be run? <span class="endmark">[2]</span>`, 2, aSessions),
            partNumber("n8_5sc_b", `<b>(b)</b> In one day the centre runs <b>${c1}</b> ${labels[bKey1].plural} and <b>${c2}</b> ${labels[bKey2].plural}.<br>The <b>TOTAL</b> session time is shared equally between <b>${staff}</b> staff to supervise.<br>Work out how many minutes <b>EACH</b> staff member supervises. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`, 3, eachStaff),
          ]);
        }
      }

      // Fallback (shouldn't be needed)
      return Q([partInteger("n8_f", `Work out: <b>84 ÷ 7</b>. <span class="endmark">[1]</span>`, 1, 12)]);
    }
    case "N9": {
      // N9 — Negative numbers (mixed operations) — GCSE style (AQA / Edexcel / OCR)
      const scenario = rng.int(1,3);

      // Helpers (ensure calculator questions use decimals)
      const pickCents = (min, max) => {
        let v;
        do { v = rng.int(min, max); } while(v % 100 === 0);
        return v;
      };
      const pickTenth = (min, max) => {
        let v;
        do { v = rng.int(min, max); } while(v % 10 === 0);
        return v;
      };
      const fmtSignedInt = (n, unit="") => `${n>=0?"+":""}${n}${unit}`;
      const fmtSigned2dp = (hund, unit="") => `${hund>=0?"+":"-"}${(Math.abs(hund)/100).toFixed(2)}${unit}`;
      const fmtMoneyStartInt = (v) => (v < 0 ? `-£${Math.abs(v)}` : `£${v}`);
      const fmtMoneyStart2dp = (p) => (p < 0 ? `-£${(Math.abs(p)/100).toFixed(2)}` : `£${(p/100).toFixed(2)}`);
      const fmtSignedMoneyInt = (v) => `${v>=0?"+":"-"}£${Math.abs(v)}`;
      const fmtSignedMoney2dp = (p) => `${p>=0?"+":"-"}£${(Math.abs(p)/100).toFixed(2)}`;

      const mk = (parts) => ({ topicCode, marksTotal, paperMode, parts });

      // =========================================================
      // 1 MARK (3 scenarios; only scenario 1 is money)
      // =========================================================
      if(marksTotal===1){
        // Scenario 1 (Money)
        if(scenario===1){
          if(!isCalc){
            const startAbs = rng.int(5,60);
            const deposit  = rng.int(5,80);
            const ans = -startAbs + deposit;

            return mk([
              partMoney(
                "n9_1_nc_s1",
                `A bank account balance is <b>-£${startAbs}</b>.<br>`+
                `<b>£${deposit}</b> is paid into the account.<br>`+
                `What is the new balance? <span class="endmark">[1]</span>`,
                1,
                ans
              )
            ]);
          } else {
            const startAbsP = pickCents(500,9000);
            const depositP  = pickCents(500,9000);
            const ansP = -startAbsP + depositP;

            return mk([
              partMoney(
                "n9_1_c_s1",
                `A bank account balance is <b>-£${(startAbsP/100).toFixed(2)}</b>.<br>`+
                `<b>£${(depositP/100).toFixed(2)}</b> is paid into the account.<br>`+
                `What is the new balance? <span class="endmark">[1]</span>`,
                1,
                roundTo(ansP/100,2)
              )
            ]);
          }
        }

        // Scenario 2 (Temperature)
        if(scenario===2){
          if(!isCalc){
            const start = -rng.int(1,15);
            const inc   = rng.int(1,20);
            const ans   = start + inc;

            return mk([
              partInteger(
                "n9_1_nc_s2",
                `The temperature is <b>${start}°C</b>.<br>`+
                `It increases by <b>${inc}°C</b>.<br>`+
                `What is the new temperature? <span class="endmark">[1]</span>`,
                1,
                ans
              )
            ]);
          } else {
            const startTenth = pickTenth(10,200);       // 1.0–20.0, not an integer
            const incHund    = pickCents(100,2500);     // 1.00–25.00, not an integer
            const start      = -startTenth/10;

            // Work in hundredths for accuracy
            const ansHund = (-startTenth*10) + incHund;
            const ans = ansHund/100;

            return mk([
              partNumber(
                "n9_1_c_s2",
                `The temperature is <b>${start.toFixed(1)}°C</b>.<br>`+
                `It increases by <b>${(incHund/100).toFixed(2)}°C</b>.<br>`+
                `What is the new temperature? <span class="endmark">[1]</span>`,
                1,
                roundTo(ans,2)
              )
            ]);
          }
        }

        // Scenario 3 (Lift floors)
        if(!isCalc){
          const start = -rng.int(1,8);
          const down  = rng.int(1,10);
          const ans   = start - down;

          return mk([
            partInteger(
              "n9_1_nc_s3",
              `A lift is at floor <b>${start}</b>.<br>`+
              `It goes down <b>${down}</b> floors.<br>`+
              `What floor is it on now? <span class="endmark">[1]</span>`,
              1,
              ans
            )
          ]);
        } else {
          const startInt = rng.int(1,8);
          const start    = -(startInt + 0.5);
          const downInt  = rng.int(1,10);
          const downFrac = rng.choice([0.25,0.5,0.75]);
          const down     = downInt + downFrac;
          const ans      = start - down;

          return mk([
            partNumber(
              "n9_1_c_s3",
              `A lift is at a height of <b>${fmt(start,2)} m</b> relative to ground level.<br>`+
              `It goes down <b>${fmt(down,2)} m</b>.<br>`+
              `What is its new height? <span class="endmark">[1]</span>`,
              1,
              roundTo(ans,2)
            )
          ]);
        }
      }

      // =========================================================
      // 2 MARK (3 scenarios; only scenario 1 is money)
      // =========================================================
      if(marksTotal===2){
        // Scenario 1 (Money)
        if(scenario===1){
          if(!isCalc){
            const startAbs = rng.int(10,80);
            const out      = rng.int(5,60);
            const inp      = rng.int(10,90);
            const ans      = -startAbs - out + inp;

            return mk([
              partMoney(
                "n9_2_nc_s1",
                `A bank account balance is <b>-£${startAbs}</b>.<br>`+
                `<b>£${out}</b> is taken out of the account.<br>`+
                `Then <b>£${inp}</b> is paid in.<br>`+
                `Work out the final balance. <span class="endmark">[2]</span>`,
                2,
                ans
              )
            ]);
          } else {
            const startAbsP = pickCents(800,12000);
            const outP      = pickCents(200,9000);
            const inP       = pickCents(500,12000);
            const ansP      = -startAbsP - outP + inP;

            return mk([
              partMoney(
                "n9_2_c_s1",
                `A bank account balance is <b>-£${(startAbsP/100).toFixed(2)}</b>.<br>`+
                `<b>£${(outP/100).toFixed(2)}</b> is taken out of the account.<br>`+
                `Then <b>£${(inP/100).toFixed(2)}</b> is paid in.<br>`+
                `Work out the final balance. <span class="endmark">[2]</span>`,
                2,
                roundTo(ansP/100,2)
              )
            ]);
          }
        }

        // Scenario 2 (Temperature with multiplication)
        if(scenario===2){
          if(!isCalc){
            const start = -rng.int(1,12);
            const fall  = rng.int(1,8);
            const inc   = rng.int(1,12);
            const ans   = start - fall*2 + inc;

            return mk([
              partInteger(
                "n9_2_nc_s2",
                `At midnight the temperature is <b>${start}°C</b>.<br>`+
                `It falls by <b>${fall}°C</b> each hour for <b>2</b> hours.<br>`+
                `Then it increases by <b>${inc}°C</b>.<br>`+
                `Work out the final temperature. <span class="endmark">[2]</span>`,
                2,
                ans
              )
            ]);
          } else {
            const startTenth = pickTenth(20,200);   // 2.0–20.0, not an integer
            const fallHund   = pickCents(50,600);   // 0.50–6.00, not an integer
            const incTenth   = pickTenth(20,120);   // 2.0–12.0, not an integer

            const start = -startTenth/10;

            // hundredths
            const ansHund = (-startTenth*10) - (fallHund*2) + (incTenth*10);
            const ans = ansHund/100;

            return mk([
              partNumber(
                "n9_2_c_s2",
                `At midnight the temperature is <b>${start.toFixed(1)}°C</b>.<br>`+
                `It falls by <b>${(fallHund/100).toFixed(2)}°C</b> each hour for <b>2</b> hours.<br>`+
                `Then it increases by <b>${(incTenth/10).toFixed(1)}°C</b>.<br>`+
                `Work out the final temperature. <span class="endmark">[2]</span>`,
                2,
                roundTo(ans,2)
              )
            ]);
          }
        }

        // Scenario 3 (Elevation)
        if(!isCalc){
          const start = -rng.int(5,40);
          const climb = rng.int(10,70);
          const down  = rng.int(5,40);
          const ans   = start + climb - down;

          return mk([
            partInteger(
              "n9_2_nc_s3",
              `A hiker starts at <b>${start} m</b> (below sea level).<br>`+
              `They climb <b>${climb} m</b>.<br>`+
              `Then they go down <b>${down} m</b>.<br>`+
              `Work out their final height relative to sea level. <span class="endmark">[2]</span>`,
              2,
              ans
            )
          ]);
        } else {
          const startTenth = pickTenth(50,350);    // 5.0–35.0, not an integer
          const climbHund  = pickCents(800,6000);  // 8.00–60.00, not an integer
          const downTenth  = pickTenth(20,300);    // 2.0–30.0, not an integer

          const start = -startTenth/10;

          // hundredths
          const ansHund = (-startTenth*10) + climbHund - (downTenth*10);
          const ans = ansHund/100;

          return mk([
            partNumber(
              "n9_2_c_s3",
              `A hiker starts at <b>${start.toFixed(1)} m</b> (below sea level).<br>`+
              `They climb <b>${(climbHund/100).toFixed(2)} m</b>.<br>`+
              `Then they go down <b>${(downTenth/10).toFixed(1)} m</b>.<br>`+
              `Work out their final height relative to sea level. <span class="endmark">[2]</span>`,
              2,
              roundTo(ans,2)
            )
          ]);
        }
      }

      // =========================================================
      // 3 MARK (3 scenarios; only scenario 1 is money; split into a + b)
      // =========================================================
      if(marksTotal===3){
        // Scenario 1 (Money)
        if(scenario===1){
          if(!isCalc){
            const startAbs = rng.int(20,80);
            const deposit  = rng.int(10,60);
            const payment  = rng.int(3,20);

            const aAns = -startAbs + deposit;
            const bAns = aAns - 3*payment;

            return mk([
              partMoney(
                "n9_3_nc_s1a",
                `<b>(a)</b> A bank account balance is <b>-£${startAbs}</b>.<br>`+
                `<b>£${deposit}</b> is paid into the account.<br>`+
                `Work out the new balance. <span class="endmark">[1]</span>`,
                1,
                aAns
              ),
              partMoney(
                "n9_3_nc_s1b",
                `<b>(b)</b> Then <b>3</b> payments of <b>£${payment}</b> are taken out.<br>`+
                `Work out the final balance. <span class="endmark">[2]</span>`,
                2,
                bAns
              ),
            ]);
          } else {
            const startAbsP = pickCents(1500,12000);
            const depositP  = pickCents(500,9000);
            const paymentP  = pickCents(200,3000);

            const aAnsP = -startAbsP + depositP;
            const bAnsP = aAnsP - 3*paymentP;

            return mk([
              partMoney(
                "n9_3_c_s1a",
                `<b>(a)</b> A bank account balance is <b>-£${(startAbsP/100).toFixed(2)}</b>.<br>`+
                `<b>£${(depositP/100).toFixed(2)}</b> is paid into the account.<br>`+
                `Work out the new balance. <span class="endmark">[1]</span>`,
                1,
                roundTo(aAnsP/100,2)
              ),
              partMoney(
                "n9_3_c_s1b",
                `<b>(b)</b> Then <b>3</b> payments of <b>£${(paymentP/100).toFixed(2)}</b> are taken out.<br>`+
                `Work out the final balance. <span class="endmark">[2]</span>`,
                2,
                roundTo(bAnsP/100,2)
              ),
            ]);
          }
        }

        // Scenario 2 (Temperature over time)
        if(scenario===2){
          if(!isCalc){
            const start = -rng.int(3,15);
            const inc   = rng.int(5,20);
            const drop1 = rng.int(2,10);
            let   drop2 = rng.int(2,10);
            if(drop2===drop1) drop2 = drop1 + 1;

            const aAns = start + inc;
            const bAns = aAns - drop1 - drop2;

            return mk([
              partInteger(
                "n9_3_nc_s2a",
                `<b>(a)</b> At <b>6am</b> the temperature is <b>${start}°C</b>.<br>`+
                `By midday it increases by <b>${inc}°C</b>.<br>`+
                `Work out the temperature at midday. <span class="endmark">[1]</span>`,
                1,
                aAns
              ),
              partInteger(
                "n9_3_nc_s2b",
                `<b>(b)</b> Overnight the temperature falls by <b>${drop1}°C</b>.<br>`+
                `Then it falls by <b>${drop2}°C</b> again.<br>`+
                `Work out the temperature the next morning. <span class="endmark">[2]</span>`,
                2,
                bAns
              ),
            ]);
          } else {
            const startTenth = pickTenth(20,200);
            const incHund    = pickCents(300,2000);
            const drop1Tenth = pickTenth(20,120);
            const drop2Hund  = pickCents(200,1500);

            const start = -startTenth/10;

            const aAnsHund = (-startTenth*10) + incHund;
            const bAnsHund = aAnsHund - (drop1Tenth*10) - drop2Hund;

            return mk([
              partNumber(
                "n9_3_c_s2a",
                `<b>(a)</b> At <b>6am</b> the temperature is <b>${start.toFixed(1)}°C</b>.<br>`+
                `By midday it increases by <b>${(incHund/100).toFixed(2)}°C</b>.<br>`+
                `Work out the temperature at midday. <span class="endmark">[1]</span>`,
                1,
                roundTo(aAnsHund/100,2)
              ),
              partNumber(
                "n9_3_c_s2b",
                `<b>(b)</b> Overnight the temperature falls by <b>${(drop1Tenth/10).toFixed(1)}°C</b>.<br>`+
                `Then it falls by <b>${(drop2Hund/100).toFixed(2)}°C</b> again.<br>`+
                `Work out the temperature the next morning. <span class="endmark">[2]</span>`,
                2,
                roundTo(bAnsHund/100,2)
              ),
            ]);
          }
        }

        // Scenario 3 (Lift with multiplication)
        if(!isCalc){
          const start = -rng.int(1,10);
          const up    = rng.int(3,10);
          const down  = rng.int(1,6);

          const aAns = start + up;
          const bAns = aAns - down*4;

          return mk([
            partInteger(
              "n9_3_nc_s3a",
              `<b>(a)</b> A lift is at floor <b>${start}</b>.<br>`+
              `It goes up <b>${up}</b> floors.<br>`+
              `Work out the new floor. <span class="endmark">[1]</span>`,
              1,
              aAns
            ),
            partInteger(
              "n9_3_nc_s3b",
              `<b>(b)</b> Then it goes down <b>${down}</b> floors, repeated <b>4</b> times.<br>`+
              `Work out the final floor. <span class="endmark">[2]</span>`,
              2,
              bAns
            ),
          ]);
        } else {
          const startInt = rng.int(1,10);
          const startHund = -(startInt*100 + 50); // x.50 floors
          const start = startHund/100;

          const upTenth  = pickTenth(20,120);      // 2.0–12.0, not an integer
          const downHund = pickCents(50,600);      // 0.50–6.00, not an integer

          const aAnsHund = startHund + (upTenth*10);
          const bAnsHund = aAnsHund - downHund*4;

          return mk([
            partNumber(
              "n9_3_c_s3a",
              `<b>(a)</b> A lift is at a height of <b>${fmt(start,2)} m</b> relative to ground level.<br>`+
              `It goes up <b>${(upTenth/10).toFixed(1)} m</b>.<br>`+
              `Work out the new height. <span class="endmark">[1]</span>`,
              1,
              roundTo(aAnsHund/100,2)
            ),
            partNumber(
              "n9_3_c_s3b",
              `<b>(b)</b> Then it goes down <b>${(downHund/100).toFixed(2)} m</b>, repeated <b>4</b> times.<br>`+
              `Work out the final height. <span class="endmark">[2]</span>`,
              2,
              roundTo(bAnsHund/100,2)
            ),
          ]);
        }
      }

      // =========================================================
      // 4 MARK (3 scenarios; only scenario 1 is money) — TABLE INCLUDED
      // (a) [1], (b) [3] — Part (b) does NOT state the numerical answer to part (a).
      // =========================================================
      if(marksTotal===4){
        // Scenario 1 (Money) — Table
        if(scenario===1){
          if(!isCalc){
            const salary = rng.int(80,200);
            const rent   = -rng.int(40,120);
            const food   = -rng.int(10,60);
            const refund = rng.int(5,40);

            const tx = [
              {label:"Salary", value:salary, sentence:"Salary is paid in."},
              {label:"Rent", value:rent, sentence:"Rent is paid."},
              {label:"Food shop", value:food, sentence:"The food shop is paid."},
              {label:"Refund", value:refund, sentence:"A refund is paid in."},
            ];

            const table =
              `<table class="qtable">`+
                `<tr><th>Transaction</th><th class="num">Amount</th></tr>`+
                `<tr><td>Salary</td><td class="num">${fmtSignedMoneyInt(salary)}</td></tr>`+
                `<tr><td>Rent</td><td class="num">${fmtSignedMoneyInt(rent)}</td></tr>`+
                `<tr><td>Food shop</td><td class="num">${fmtSignedMoneyInt(food)}</td></tr>`+
                `<tr><td>Refund</td><td class="num">${fmtSignedMoneyInt(refund)}</td></tr>`+
              `</table>`;

            let startBal = rng.int(-80,80);
            while(startBal===0) startBal = rng.int(-80,80);

            // (a) randomise the transaction used (ensure a negative number is involved)
            let txA = rng.choice(tx);
            if(startBal>0){
              txA = rng.choice(tx.filter(t=>t.value<0));
            }
            const aAns = startBal + txA.value;

            // (b) randomise which 3 transactions are used, and the order they happen in
            const bTx = rng.shuffle(tx).slice(0,3);
            const bAns = startBal + bTx.reduce((s,t)=>s+t.value,0);
            const bLines = bTx.map((t,i)=> (i===0 ? `${t.sentence}<br>` : `Then ${t.sentence}<br>`)).join("");

            return mk([
              partMoney(
                "n9_4_nc_s1a",
                `A bank statement shows transactions.<br>${table}<br>`+
                `<b>(a)</b> The account balance starts at <b>${fmtMoneyStartInt(startBal)}</b>.<br>`+
                `${txA.sentence}<br>`+
                `What is the new balance? <span class="endmark">[1]</span>`,
                1,
                aAns
              ),
              partMoney(
                "n9_4_nc_s1b",
                `<b>(b)</b> The account balance starts at <b>${fmtMoneyStartInt(startBal)}</b>.<br>`+
                `${bLines}`+
                `Work out the final balance. <span class="endmark">[3]</span>`,
                3,
                bAns
              ),
            ]);
          }else{
            const salaryP = pickCents(8000,20000);
            const rentP   = -pickCents(4000,12000);
            const foodP   = -pickCents(1000,6000);
            const refundP = pickCents(500,4000);

            const tx = [
              {label:"Salary", value:salaryP, sentence:"Salary is paid in."},
              {label:"Rent", value:rentP, sentence:"Rent is paid."},
              {label:"Food shop", value:foodP, sentence:"The food shop is paid."},
              {label:"Refund", value:refundP, sentence:"A refund is paid in."},
            ];

            const table =
              `<table class="qtable">`+
                `<tr><th>Transaction</th><th class="num">Amount</th></tr>`+
                `<tr><td>Salary</td><td class="num">${fmtSignedMoney2dp(salaryP)}</td></tr>`+
                `<tr><td>Rent</td><td class="num">${fmtSignedMoney2dp(rentP)}</td></tr>`+
                `<tr><td>Food shop</td><td class="num">${fmtSignedMoney2dp(foodP)}</td></tr>`+
                `<tr><td>Refund</td><td class="num">${fmtSignedMoney2dp(refundP)}</td></tr>`+
              `</table>`;

            const startAbsP = pickCents(500,9000);
            const startP = rng.choice([-startAbsP, startAbsP]);

            let txA = rng.choice(tx);
            if(startP>0){
              txA = rng.choice(tx.filter(t=>t.value<0));
            }
            const aAnsP = startP + txA.value;

            const bTx = rng.shuffle(tx).slice(0,3);
            const bAnsP = startP + bTx.reduce((s,t)=>s+t.value,0);
            const bLines = bTx.map((t,i)=> (i===0 ? `${t.sentence}<br>` : `Then ${t.sentence}<br>`)).join("");

            return mk([
              partMoney(
                "n9_4_c_s1a",
                `A bank statement shows transactions.<br>${table}<br>`+
                `<b>(a)</b> The account balance starts at <b>${fmtMoneyStart2dp(startP)}</b>.<br>`+
                `${txA.sentence}<br>`+
                `What is the new balance? <span class="endmark">[1]</span>`,
                1,
                roundTo(aAnsP/100,2)
              ),
              partMoney(
                "n9_4_c_s1b",
                `<b>(b)</b> The account balance starts at <b>${fmtMoneyStart2dp(startP)}</b>.<br>`+
                `${bLines}`+
                `Work out the final balance. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`,
                3,
                roundTo(bAnsP/100,2)
              ),
            ]);
          }
        }
        // Scenario 2 (Temperature changes)
        if(!isCalc){
          const start     = -rng.int(6,20);
          const morning   = rng.int(2,12);
          const afternoon = -rng.int(2,12);
          const evening   = -rng.int(1,9);
          const overnight = rng.int(1,7);

          const table =
            `<table class="qtable">`+
              `<tr><th>Change time</th><th class="num">Change</th></tr>`+
              `<tr><td>Morning</td><td class="num">${fmtSignedInt(morning,"°C")}</td></tr>`+
              `<tr><td>Afternoon</td><td class="num">${fmtSignedInt(afternoon,"°C")}</td></tr>`+
              `<tr><td>Evening</td><td class="num">${fmtSignedInt(evening,"°C")}</td></tr>`+
              `<tr><td>Overnight</td><td class="num">${fmtSignedInt(overnight,"°C")}</td></tr>`+
            `</table>`;

          const changes = [
            {name:"morning", value:morning},
            {name:"afternoon", value:afternoon},
            {name:"evening", value:evening},
            {name:"overnight", value:overnight},
          ];

          // Randomise which single change is used in (a)
          const chA = rng.choice(changes);
          const aAns = start + chA.value;

          // Randomise the order the changes are referenced in (b)
          const order = rng.shuffle(changes);
          const bAns = start + changes.reduce((s,c)=>s+c.value,0);
          const bLines = order.map((c,i)=> (i===0 ? `Apply the ${c.name} change.<br>` : `Then apply the ${c.name} change.<br>`)).join("");

          return mk([
            partInteger(
              "n9_4_nc_s2a",
              `A weather station records temperature changes.<br>${table}<br>`+
              `<b>(a)</b> The temperature starts at <b>${start}°C</b>.<br>`+
              `Apply the ${chA.name} change.<br>`+
              `Work out the new temperature. <span class="endmark">[1]</span>`,
              1,
              aAns
            ),
            partInteger(
              "n9_4_nc_s2b",
              `<b>(b)</b> The temperature starts at <b>${start}°C</b>.<br>`+
              `${bLines}`+
              `Work out the final temperature. <span class="endmark">[3]</span>`,
              3,
              bAns
            ),
          ]);
        } else {
          const startHund     = -pickCents(300,1600);
          const morningHund   = pickCents(200,1200);
          const afternoonHund = -pickCents(150,1200);
          const eveningHund   = -pickCents(100,900);
          const overnightHund = pickCents(100,700);

          const table =
            `<table class="qtable">`+
              `<tr><th>Change time</th><th class="num">Change</th></tr>`+
              `<tr><td>Morning</td><td class="num">${fmtSigned2dp(morningHund,"°C")}</td></tr>`+
              `<tr><td>Afternoon</td><td class="num">${fmtSigned2dp(afternoonHund,"°C")}</td></tr>`+
              `<tr><td>Evening</td><td class="num">${fmtSigned2dp(eveningHund,"°C")}</td></tr>`+
              `<tr><td>Overnight</td><td class="num">${fmtSigned2dp(overnightHund,"°C")}</td></tr>`+
            `</table>`;

          const changes = [
            {name:"morning", value:morningHund},
            {name:"afternoon", value:afternoonHund},
            {name:"evening", value:eveningHund},
            {name:"overnight", value:overnightHund},
          ];

          const chA = rng.choice(changes);
          const aAnsHund = startHund + chA.value;

          const order = rng.shuffle(changes);
          const bAnsHund = startHund + changes.reduce((s,c)=>s+c.value,0);
          const bLines = order.map((c,i)=> (i===0 ? `Apply the ${c.name} change.<br>` : `Then apply the ${c.name} change.<br>`)).join("");

          return mk([
            partNumber(
              "n9_4_c_s2a",
              `A weather station records temperature changes.<br>${table}<br>`+
              `<b>(a)</b> The temperature starts at <b>${fmtNo00(startHund/100,2)}°C</b>.<br>`+
              `Apply the ${chA.name} change.<br>`+
              `Work out the new temperature. Give your answer to <b>2</b> decimal places. <span class="endmark">[1]</span>`,
              1,
              roundTo(aAnsHund/100,2)
            ),
            partNumber(
              "n9_4_c_s2b",
              `<b>(b)</b> The temperature starts at <b>${fmtNo00(startHund/100,2)}°C</b>.<br>`+
              `${bLines}`+
              `Work out the final temperature. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`,
              3,
              roundTo(bAnsHund/100,2)
            ),
          ]);
        }
// Scenario 3 (Level changes) — Table
        if(!isCalc){
          const start       = -rng.int(1,8);
          const goDown      = -rng.int(2,6);
          const goUp        = rng.int(3,9);
          const goDownAgain = -rng.int(1,6);
          const returnUp    = rng.int(2,8);

          const table =
            `<table class="qtable">`+
              `<tr><th>Action</th><th class="num">Change in floors</th></tr>`+
              `<tr><td>Go down</td><td class="num">${fmtSignedInt(goDown)}</td></tr>`+
              `<tr><td>Go up</td><td class="num">${fmtSignedInt(goUp)}</td></tr>`+
              `<tr><td>Go down again</td><td class="num">${fmtSignedInt(goDownAgain)}</td></tr>`+
              `<tr><td>Return up</td><td class="num">${fmtSignedInt(returnUp)}</td></tr>`+
            `</table>`;

          const aAns = start + goDown;
          const bAns = start + goDown + goUp + goDownAgain;

          return mk([
            partInteger(
              "n9_4_nc_s3a",
              `An engineer records level changes in a building.<br>${table}<br>`+
              `<b>(a)</b> The engineer starts at floor <b>${start}</b>.<br>`+
              `They go down.<br>`+
              `What floor are they on now? <span class="endmark">[1]</span>`,
              1,
              aAns
            ),
            partInteger(
              "n9_4_nc_s3b",
              `<b>(b)</b> The engineer starts at floor <b>${start}</b>.<br>`+
              `They go down.<br>`+
              `Then they go up.<br>`+
              `Then they go down again.<br>`+
              `Work out the final floor. <span class="endmark">[3]</span>`,
              3,
              bAns
            ),
          ]);
        } else {
          const startTenth = pickTenth(10,60); // 1.0–6.0, not an integer
          const startHund  = -startTenth*10;
          const start      = startHund/100;

          const goDownHund      = -pickCents(200,900);
          const goUpHund        = pickCents(200,900);
          const goDownAgainHund = -pickCents(100,700);
          const returnUpHund    = pickCents(200,900);

          const table =
            `<table class="qtable">`+
              `<tr><th>Action</th><th class="num">Change in metres</th></tr>`+
              `<tr><td>Go down</td><td class="num">${fmtSigned2dp(goDownHund)}</td></tr>`+
              `<tr><td>Go up</td><td class="num">${fmtSigned2dp(goUpHund)}</td></tr>`+
              `<tr><td>Go down again</td><td class="num">${fmtSigned2dp(goDownAgainHund)}</td></tr>`+
              `<tr><td>Return up</td><td class="num">${fmtSigned2dp(returnUpHund)}</td></tr>`+
            `</table>`;

          const aAnsHund = startHund + goDownHund;
          const bAnsHund = startHund + goDownHund + goUpHund + goDownAgainHund;

          return mk([
            partNumber(
              "n9_4_c_s3a",
              `An engineer records level changes in a building.<br>${table}<br>`+
              `<b>(a)</b> The engineer starts at a height of <b>${start.toFixed(1)} m</b> relative to ground level.<br>`+
              `They go down.<br>`+
              `What is the new height? <span class="endmark">[1]</span>`,
              1,
              roundTo(aAnsHund/100,2)
            ),
            partNumber(
              "n9_4_c_s3b",
              `<b>(b)</b> The engineer starts at a height of <b>${start.toFixed(1)} m</b> relative to ground level.<br>`+
              `They go down.<br>`+
              `Then they go up.<br>`+
              `Then they go down again.<br>`+
              `Work out the final height. <span class="endmark">[3]</span>`,
              3,
              roundTo(bAnsHund/100,2)
            ),
          ]);
        }
      }

      // =========================================================
      // 5 MARK (3 scenarios; only scenario 1 is money) — TABLE INCLUDED
      // (a) [2], (b) [3]
      // =========================================================
      if(marksTotal===5){
        // Scenario 1 (Money) — Table
        if(scenario===1){
          if(!isCalc){
            const startAbs = rng.int(5,40);
            const start    = rng.choice([-startAbs, startAbs]);

            const deposit  = rng.int(20,90);
            const bill     = -rng.int(10,60);
            const fee      = -rng.int(5,25);
            const refund   = rng.int(5,30);

            const tx = {
              deposit:{label:"Deposit", value:deposit, first:"A deposit is paid in.", then:"a deposit is paid in."},
              bill:{label:"Bill", value:bill, first:"A bill is paid.", then:"a bill is paid.", doubleFirst:"<b>2</b> bills are paid.", doubleThen:"<b>2</b> bills are paid."},
              fee:{label:"Fee", value:fee, first:"A fee is taken.", then:"a fee is taken.", doubleFirst:"<b>2</b> fees are taken.", doubleThen:"<b>2</b> fees are taken."},
              refund:{label:"Refund", value:refund, first:"A refund is paid in.", then:"a refund is paid in."},
            };

            const table =
              `<table class="qtable">`+
                `<tr><th>Transaction</th><th class="num">Amount</th></tr>`+
                `<tr><td>Deposit</td><td class="num">${fmtSignedMoneyInt(deposit)}</td></tr>`+
                `<tr><td>Bill</td><td class="num">${fmtSignedMoneyInt(bill)}</td></tr>`+
                `<tr><td>Fee</td><td class="num">${fmtSignedMoneyInt(fee)}</td></tr>`+
                `<tr><td>Refund</td><td class="num">${fmtSignedMoneyInt(refund)}</td></tr>`+
              `</table>`;

            const posKeys = ["deposit","refund"];
            const negKeys = ["bill","fee"];

            // (a) pick one positive and one negative transaction, and randomise the order they are mentioned
            const posA = rng.choice(posKeys);
            const negA = rng.choice(negKeys);
            const aOrder = rng.shuffle([posA, negA]);

            const aAns = start + tx[posA].value + tx[negA].value;
            const aLines =
              (aOrder[0]===posA || aOrder[0]===negA ? `${tx[aOrder[0]].first}<br>` : "") +
              `Then ${tx[aOrder[1]].then}<br>`;

            // (b) use both negative transaction types, and double one of them (varies the operations)
            const negDouble = rng.choice(negKeys);
            const negSingle = negKeys.find(k=>k!==negDouble);
            const posB = rng.choice(posKeys);

            const firstTwo = rng.shuffle([negSingle, posB]);
            const bAns = aAns + tx[firstTwo[0]].value + tx[firstTwo[1]].value + 2*tx[negDouble].value;

            const bLines =
              `${tx[firstTwo[0]].first}<br>`+
              `Then ${tx[firstTwo[1]].then}<br>`+
              `Then ${tx[negDouble].doubleThen}<br>`;

            return mk([
              partMoney(
                "n9_5_nc_s1a",
                `A bank account has these transactions.<br>${table}<br>`+
                `<b>(a)</b> The account balance starts at <b>${fmtMoneyStartInt(start)}</b>.<br>`+
                `${tx[aOrder[0]].first}<br>`+
                `Then ${tx[aOrder[1]].then}<br>`+
                `Work out the new balance. <span class="endmark">[2]</span>`,
                2,
                aAns
              ),
              partMoney(
                "n9_5_nc_s1b",
                `<b>(b)</b> Start with your answer to part <b>(a)</b>.<br>`+
                `${bLines}`+
                `Work out the final balance. <span class="endmark">[3]</span>`,
                3,
                bAns
              ),
            ]);
          }else{
            const startAbsP = pickCents(500, 9000);
            const startP    = rng.choice([-startAbsP, startAbsP]);

            const depositP  = pickCents(2000, 9000);
            const billP     = -pickCents(1000, 6000);
            const feeP      = -pickCents(500, 2500);
            const refundP   = pickCents(500, 3000);

            const tx = {
              deposit:{label:"Deposit", value:depositP, first:"A deposit is paid in.", then:"a deposit is paid in."},
              bill:{label:"Bill", value:billP, first:"A bill is paid.", then:"a bill is paid.", doubleFirst:"<b>2</b> bills are paid.", doubleThen:"<b>2</b> bills are paid."},
              fee:{label:"Fee", value:feeP, first:"A fee is taken.", then:"a fee is taken.", doubleFirst:"<b>2</b> fees are taken.", doubleThen:"<b>2</b> fees are taken."},
              refund:{label:"Refund", value:refundP, first:"A refund is paid in.", then:"a refund is paid in."},
            };

            const table =
              `<table class="qtable">`+
                `<tr><th>Transaction</th><th class="num">Amount</th></tr>`+
                `<tr><td>Deposit</td><td class="num">${fmtSignedMoney2dp(depositP)}</td></tr>`+
                `<tr><td>Bill</td><td class="num">${fmtSignedMoney2dp(billP)}</td></tr>`+
                `<tr><td>Fee</td><td class="num">${fmtSignedMoney2dp(feeP)}</td></tr>`+
                `<tr><td>Refund</td><td class="num">${fmtSignedMoney2dp(refundP)}</td></tr>`+
              `</table>`;

            const posKeys = ["deposit","refund"];
            const negKeys = ["bill","fee"];

            const posA = rng.choice(posKeys);
            const negA = rng.choice(negKeys);
            const aOrder = rng.shuffle([posA, negA]);

            const aAnsP = startP + tx[posA].value + tx[negA].value;

            const negDouble = rng.choice(negKeys);
            const negSingle = negKeys.find(k=>k!==negDouble);
            const posB = rng.choice(posKeys);

            const firstTwo = rng.shuffle([negSingle, posB]);
            const bAnsP = aAnsP + tx[firstTwo[0]].value + tx[firstTwo[1]].value + 2*tx[negDouble].value;

            const bLines =
              `${tx[firstTwo[0]].first}<br>`+
              `Then ${tx[firstTwo[1]].then}<br>`+
              `Then ${tx[negDouble].doubleThen}<br>`;

            return mk([
              partMoney(
                "n9_5_c_s1a",
                `A bank account has these transactions.<br>${table}<br>`+
                `<b>(a)</b> The account balance starts at <b>${fmtMoneyStart2dp(startP)}</b>.<br>`+
                `${tx[aOrder[0]].first}<br>`+
                `Then ${tx[aOrder[1]].then}<br>`+
                `Work out the new balance. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`,
                2,
                roundTo(aAnsP/100,2)
              ),
              partMoney(
                "n9_5_c_s1b",
                `<b>(b)</b> Start with your answer to part <b>(a)</b>.<br>`+
                `${bLines}`+
                `Work out the final balance. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`,
                3,
                roundTo(bAnsP/100,2)
              ),
            ]);
          }
        }

        // Scenario 2 (Temperature and repeated change) — Table
if(scenario===2){
          if(!isCalc){
            const startTemp = -rng.int(6,20);
            const heating   = rng.int(4,12);
            const nightDrop = -rng.int(3,10);
            const windDrop  = -rng.int(2,9);

            const table =
              `<table class="qtable">`+
                `<tr><th>Item</th><th class="num">Value</th></tr>`+
                `<tr><td>Start temperature</td><td class="num">${startTemp}°C</td></tr>`+
                `<tr><td>Heating change</td><td class="num">${fmtSignedInt(heating,"°C")}</td></tr>`+
                `<tr><td>Night drop</td><td class="num">${fmtSignedInt(nightDrop,"°C")}</td></tr>`+
                `<tr><td>Wind chill drop</td><td class="num">${fmtSignedInt(windDrop,"°C")}</td></tr>`+
              `</table>`;

            const changes = [
              {key:"heating", label:"heating change", value:heating},
              {key:"night", label:"night drop", value:nightDrop},
              {key:"wind", label:"wind chill drop", value:windDrop},
            ];

            // Randomise which two changes are used in (a) and their order
            const aSteps = rng.shuffle(changes).slice(0,2);
            const aAns = startTemp + aSteps[0].value + aSteps[1].value;

            // Randomise which negative drop is repeated in (b)
            const rep = rng.choice(changes.filter(c=>c.key!=="heating"));
            const times = 4;
            const bAns = aAns + rep.value*times;

            return mk([
              partInteger(
                "n9_5_nc_s2a",
                `A temperature log shows changes.<br>${table}<br>`+
                `<b>(a)</b> Start at the start temperature.<br>`+
                `Apply the ${aSteps[0].label}.<br>`+
                `Then apply the ${aSteps[1].label}.<br>`+
                `Work out the temperature. <span class="endmark">[2]</span>`,
                2,
                aAns
              ),
              partInteger(
                "n9_5_nc_s2b",
                `<b>(b)</b> Start from your answer to part <b>(a)</b>.<br>`+
                `Apply the ${rep.label} <b>${times}</b> times.<br>`+
                `Work out the final temperature. <span class="endmark">[3]</span>`,
                3,
                bAns
              ),
            ]);
          }else{
            const startHund = -pickCents(300,1600);
            const heatingHund = pickCents(400,1200);
            const nightHund = -pickCents(300,1000);
            const windHund = -pickCents(200,900);

            const table =
              `<table class="qtable">`+
                `<tr><th>Item</th><th class="num">Value</th></tr>`+
                `<tr><td>Start temperature</td><td class="num">${fmtNo00(startHund/100,2)}°C</td></tr>`+
                `<tr><td>Heating change</td><td class="num">${fmtSigned2dp(heatingHund,"°C")}</td></tr>`+
                `<tr><td>Night drop</td><td class="num">${fmtSigned2dp(nightHund,"°C")}</td></tr>`+
                `<tr><td>Wind chill drop</td><td class="num">${fmtSigned2dp(windHund,"°C")}</td></tr>`+
              `</table>`;

            const changes = [
              {key:"heating", label:"heating change", value:heatingHund},
              {key:"night", label:"night drop", value:nightHund},
              {key:"wind", label:"wind chill drop", value:windHund},
            ];

            const aSteps = rng.shuffle(changes).slice(0,2);
            const aAnsHund = startHund + aSteps[0].value + aSteps[1].value;

            const rep = rng.choice(changes.filter(c=>c.key!=="heating"));
            const times = 4;
            const bAnsHund = aAnsHund + rep.value*times;

            return mk([
              partNumber(
                "n9_5_c_s2a",
                `A temperature log shows changes.<br>${table}<br>`+
                `<b>(a)</b> Start at the start temperature.<br>`+
                `Apply the ${aSteps[0].label}.<br>`+
                `Then apply the ${aSteps[1].label}.<br>`+
                `Work out the temperature. <span class="endmark">[2]</span>`,
                2,
                roundTo(aAnsHund/100,2)
              ),
              partNumber(
                "n9_5_c_s2b",
                `<b>(b)</b> Start from your answer to part <b>(a)</b>.<br>`+
                `Apply the ${rep.label} <b>${times}</b> times.<br>`+
                `Work out the final temperature. <span class="endmark">[3]</span>`,
                3,
                roundTo(bAnsHund/100,2)
              ),
            ]);
          }
        }

        // Scenario 3 (Location: altitude changes over days) — Table
        if(!isCalc){
          // Two positive and two negative daily changes (whole numbers)
          const days = ["Monday","Tuesday","Wednesday","Thursday"];
          const mags = [
            rng.int(5,25),
            rng.int(5,30),
            rng.int(3,20),
            rng.int(4,22),
          ];
          const signs = rng.shuffle([-1,-1,1,1]);

          const change = {
            "Monday":    signs[0]*mags[0],
            "Tuesday":   signs[1]*mags[1],
            "Wednesday": signs[2]*mags[2],
            "Thursday":  signs[3]*mags[3],
          };

          const table =
            `<table class="qtable">`+
              `<tr><th>Day</th><th class="num">Change in altitude</th></tr>`+
              `<tr><td>Monday</td><td class="num">${fmtSignedInt(change["Monday"]," m")}</td></tr>`+
              `<tr><td>Tuesday</td><td class="num">${fmtSignedInt(change["Tuesday"]," m")}</td></tr>`+
              `<tr><td>Wednesday</td><td class="num">${fmtSignedInt(change["Wednesday"]," m")}</td></tr>`+
              `<tr><td>Thursday</td><td class="num">${fmtSignedInt(change["Thursday"]," m")}</td></tr>`+
            `</table>`;

          // Start altitude is non-zero
          let start = rng.int(-250,250);
          while(start===0) start = rng.int(-250,250);

          // Ensure BOTH parts use one negative and one positive day
          const negDays = days.filter(d=>change[d]<0);
          const posDays = days.filter(d=>change[d]>0);

          const aNeg = rng.choice(negDays);
          const aPos = rng.choice(posDays);
          const aDays = rng.shuffle([aNeg, aPos]);

          const bNeg = negDays.find(d=>d!==aNeg);
          const bPos = posDays.find(d=>d!==aPos);
          const bDays = rng.shuffle([bNeg, bPos]);

          const aAns = start + change[aDays[0]] + change[aDays[1]];

          // Vary the operations in (b): sometimes one day is doubled, and the final adjustment can be + or -
          const adjust = rng.int(3,25);
          const adjustOp = rng.choice(["add","subtract"]);
          const adjustSigned = (adjustOp==="add") ? adjust : -adjust;

          const useDouble = rng.choice([true,false]);
          let bAns, bInstr;
          if(useDouble){
            const dblDay = rng.choice(bDays);
            const otherDay = bDays.find(d=>d!==dblDay);
            bAns = aAns + change[otherDay] + 2*change[dblDay] + adjustSigned;
            bInstr =
              `Add ${otherDay}.<br>`+
              `Then add <b>double</b> ${dblDay}.<br>`+
              `Then ${adjustOp} <b>${adjust} m</b> (an extra change).<br>`;
          }else{
            bAns = aAns + change[bDays[0]] + change[bDays[1]] + adjustSigned;
            bInstr =
              `Add ${bDays[0]} and ${bDays[1]}.<br>`+
              `Then ${adjustOp} <b>${adjust} m</b> (an extra change).<br>`;
          }

          return mk([
            partInteger(
              "n9_5_nc_s3a",
              `A hiker records changes in altitude each day.<br>${table}<br>`+
              `<b>(a)</b> The altitude starts at <b>${start} m</b>.<br>`+
              `Add ${aDays[0]} and ${aDays[1]}.<br>`+
              `Work out the altitude. <span class="endmark">[2]</span>`,
              2,
              aAns
            ),
            partInteger(
              "n9_5_nc_s3b",
              `<b>(b)</b> Start from your answer to part <b>(a)</b>.<br>`+
              `${bInstr}`+
              `Work out the final altitude. <span class="endmark">[3]</span>`,
              3,
              bAns
            ),
          ]);
        } else {
          // calculator version: hundredths of a metre (2 dp)
          const days = ["Monday","Tuesday","Wednesday","Thursday"];

          const mags = [
            pickCents(500, 2500),
            pickCents(500, 3000),
            pickCents(300, 2000),
            pickCents(400, 2200),
          ];
          const signs = rng.shuffle([-1,-1,1,1]);

          const changeP = {
            "Monday":    signs[0]*mags[0],
            "Tuesday":   signs[1]*mags[1],
            "Wednesday": signs[2]*mags[2],
            "Thursday":  signs[3]*mags[3],
          };

          const table =
            `<table class="qtable">`+
              `<tr><th>Day</th><th class="num">Change in altitude</th></tr>`+
              `<tr><td>Monday</td><td class="num">${fmtSigned2dp(changeP["Monday"]," m")}</td></tr>`+
              `<tr><td>Tuesday</td><td class="num">${fmtSigned2dp(changeP["Tuesday"]," m")}</td></tr>`+
              `<tr><td>Wednesday</td><td class="num">${fmtSigned2dp(changeP["Wednesday"]," m")}</td></tr>`+
              `<tr><td>Thursday</td><td class="num">${fmtSigned2dp(changeP["Thursday"]," m")}</td></tr>`+
            `</table>`;

          const startAbsP = pickCents(500, 20000);
          const startP = rng.choice([-startAbsP, startAbsP]);

          const negDays = days.filter(d=>changeP[d]<0);
          const posDays = days.filter(d=>changeP[d]>0);

          const aNeg = rng.choice(negDays);
          const aPos = rng.choice(posDays);
          const aDays = rng.shuffle([aNeg, aPos]);

          const bNeg = negDays.find(d=>d!==aNeg);
          const bPos = posDays.find(d=>d!==aPos);
          const bDays = rng.shuffle([bNeg, bPos]);

          const aAnsP = startP + changeP[aDays[0]] + changeP[aDays[1]];

          const adjustP = pickCents(200, 4000);
          const adjustOp = rng.choice(["add","subtract"]);
          const adjustSignedP = (adjustOp==="add") ? adjustP : -adjustP;

          const useDouble = rng.choice([true,false]);
          let bAnsP, bInstr;
          if(useDouble){
            const dblDay = rng.choice(bDays);
            const otherDay = bDays.find(d=>d!==dblDay);

            const multOpts = [
              {m:2, word:"double"},
              {m:3, word:"triple"},
              {m:4, word:"quadruple"},
              {m:5, word:"five times"},
            ];
            const mult = rng.choice(multOpts);

            bAnsP = aAnsP + changeP[otherDay] + mult.m*changeP[dblDay] + adjustSignedP;
            bInstr =
              `Add ${otherDay}.<br>`+
              `Then add <b>${mult.word}</b> ${dblDay}.<br>`+
              `Then ${adjustOp} <b>${(adjustP/100).toFixed(2)} m</b> (an extra change).<br>`;
          }else{
            bAnsP = aAnsP + changeP[bDays[0]] + changeP[bDays[1]] + adjustSignedP;
            bInstr =
              `Add ${bDays[0]} and ${bDays[1]}.<br>`+
              `Then ${adjustOp} <b>${(adjustP/100).toFixed(2)} m</b> (an extra change).<br>`;
          }


          return mk([
            partNumber(
              "n9_5_c_s3a",
              `A hiker records changes in altitude each day.<br>${table}<br>`+
              `<b>(a)</b> The altitude starts at <b>${(startP/100).toFixed(2)} m</b>.<br>`+
              `Add ${aDays[0]} and ${aDays[1]}.<br>`+
              `Work out the altitude. Give your answer to <b>2</b> decimal places. <span class="endmark">[2]</span>`,
              2,
              roundTo(aAnsP/100,2)
            ),
            partNumber(
              "n9_5_c_s3b",
              `<b>(b)</b> Start from your answer to part <b>(a)</b>.<br>`+
              `${bInstr}`+
              `Work out the final altitude. Give your answer to <b>2</b> decimal places. <span class="endmark">[3]</span>`,
              3,
              roundTo(bAnsP/100,2)
            ),
          ]);
        }
      }

      // Shouldn't be needed
      return mk([partInteger("n9_fallback", `Work out: <b>-5 + 8</b>. <span class="endmark">[1]</span>`, 1, 3)]);
    }
    /* SPLITMERGE:BUILDQUESTION-CASES-END */

    default:
      return Q([partNumber("x", `Not implemented. <span class="endmark">[${marksTotal}]</span>`, marksTotal, 0)]);
  }
}


function renderInput(input, answerType, baseId, partTextHtml){
  if (!input) return "";
  const kind = input.kind;

  // Helper: strip HTML tags so we can infer a sensible unit for the placeholder
  const stripHtml = (s)=> String(s||"")
    .replace(/<[^>]*>/g," ")
    .replace(/&nbsp;/g," ")
    .replace(/\s+/g," ")
    .trim();

  const lastMatchIndex = (str, re)=>{
    const flags = re.flags.includes("g") ? re.flags : (re.flags + "g");
    const rg = new RegExp(re.source, flags);
    let m, idx = -1;
    while((m = rg.exec(str))!==null){
      idx = m.index;
    }
    return idx;
  };

  const addNoUnits = (ph)=>{
    const s = String(ph||"").trim();
    return s || "answer";
  };

  const safePh = (ph)=>{
    const s = String(ph||"").trim();
    if(!s || /^[abc]$/i.test(s)) return "answer";
    return s;
  };

  const inferUnit = ()=>{
    const t = stripHtml(partTextHtml);

    if(!t) return "";

    // Explicit GCSE-style "(in ...)" cues
    let m = t.match(/\(in\s+([^)]+)\)/i);
    if(m && m[1]) return m[1].trim();

    // Common phrasing
    if(/km\s+per\s+hour/i.test(t)) return "km/h";

    // Topic-specific and symbol-based units (avoid false placeholders)
    if(/°\s*C/i.test(t) || /\btemperature\b/i.test(t)) return "°C";
    if(/\bfloors?\b/i.test(t) || /\bfloor\b/i.test(t)) return "floor";
    if(/\bsweets?\b/i.test(t)) return "sweets";

    // "How many ___" often names the unit directly
    m = t.match(/how many\s+([^?\.]+?)(?=\s+(?:are|is|does|do|can|were|was|will|could|should|would)\b|[?\.])/i);
    if(m && m[1]) return m[1].trim();

    // Otherwise, pick the unit-like word/phrase that appears latest in the text
    const candidates = [
      {re:/kwh\b/i, u:"kWh"},
      {re:/kw\b/i, u:"kW"},
      {re:/\bm²\b|m\^2\b|m2\b/i, u:"m²"},
      {re:/\bcm\b/i, u:"cm"},
      {re:/\bmm\b/i, u:"mm"},
      {re:/\bkm\b/i, u:"km"},
      {re:/\blitres\b|\bliters\b|\blitre\b|\bliter\b/i, u:"litres"},
      {re:/\bkg\b/i, u:"kg"},
      {re:/\bg\b/i, u:"g"},
      {re:/\bminutes\b|\bminute\b/i, u:"minutes"},
      {re:/\bhours\b|\bhour\b/i, u:"hours"},
      {re:/\bpages\b|\bpage\b/i, u:"pages"},
      {re:/\bbags\b|\bbag\b/i, u:"bags"},
      {re:/\btrips\b|\btrip\b/i, u:"trips"},
      {re:/\bsessions\b|\bsession\b/i, u:"sessions"},
      {re:/\bboxes\b|\bbox\b/i, u:"boxes"},
      {re:/\btickets\b|\bticket\b/i, u:"tickets"},
      {re:/\bitems\b|\bitem\b/i, u:"items"},
      {re:/\bpeople\b|\bperson\b/i, u:"people"},
      {re:/\bcontainers\b|\bcontainer\b/i, u:"containers"},
      {re:/\bcups\b|\bcup\b/i, u:"cups"},
      {re:/\bjugs\b|\bjug\b/i, u:"jugs"},
      {re:/\blaps\b|\blap\b/i, u:"laps"},
      {re:/\bmetres\b|\bmeters\b/i, u:"m"},
      // keep "m" last (very general)
      {re:/\bm\b/i, u:"m"},
    ];

    let bestU = "";
    let bestIdx = -1;

    for(const c of candidates){
      const idx = lastMatchIndex(t, c.re);
      if(idx < 0) continue;
      if(idx > bestIdx || (idx === bestIdx && c.u.length > bestU.length)){
        bestIdx = idx;
        bestU = c.u;
      }
    }
    return bestU;
  };

  const defaultUnitPlaceholder = ()=>{
    const unit = inferUnit();
    return unit ? addNoUnits(unit) : "answer";
  };

  if (kind==="fraction" || answerType==="fraction"){
    return `
      <span class="frac" aria-label="fraction answer">
        <input id="${baseId}N" class="mini" type="text" inputmode="numeric" placeholder="numerator" />
        <span class="bar"></span>
        <input id="${baseId}D" class="mini" type="text" inputmode="numeric" placeholder="denominator" />
      </span>
    `;
  }

  if (kind==="pair"){
    const lab0 = input.labels?.[0];
    const lab1 = input.labels?.[1];
    const ph0 = safePh(input.placeholders?.[0]||"a");
    const ph1 = safePh(input.placeholders?.[1]||"b");
    const labelHtml = (t)=> t ? `<span style="font-weight:900;color:#111827">${t}</span>` : "";
    return `
      <span class="twobox" aria-label="two answers">
        ${labelHtml(lab0)}
        <input id="${baseId}A" class="mini" type="text" inputmode="decimal" placeholder="${ph0}" />
        ${labelHtml(lab1)}
        <input id="${baseId}B" class="mini" type="text" inputmode="decimal" placeholder="${ph1}" />
      </span>
    `;
  }

  if (kind==="triple"){
    const ph0 = safePh(input.placeholders?.[0]||"a");
    const ph1 = safePh(input.placeholders?.[1]||"b");
    const ph2 = safePh(input.placeholders?.[2]||"c");
    return `
      <span class="threebox" aria-label="three answers">
        <input id="${baseId}A" class="mini" type="text" inputmode="decimal" placeholder="${ph0}" />
        <input id="${baseId}B" class="mini" type="text" inputmode="decimal" placeholder="${ph1}" />
        <input id="${baseId}C" class="mini" type="text" inputmode="decimal" placeholder="${ph2}" />
      </span>
    `;
  }

  if (kind==="standardForm" || answerType==="standardForm"){
    // Single entry box only. Press EXP to insert ×10 and then type the power as a superscript.
    return `
      <div class="sfwrap" aria-label="standard form answer">
        <input id="${baseId}" class="sfinput" type="text" inputmode="decimal" placeholder="e.g. 3.2×10⁵" autocomplete="off" />
        <div class="keypad sfctrl" data-sf-target="${baseId}">
          <button class="kbtn accent" data-act="exp">EXP</button>
          <button class="kbtn" data-act="neg">±</button>
          <button class="kbtn" data-act="bksp">⌫</button>
          <button class="kbtn" data-act="clear">Clear</button>
        </div>
        <div class="sfhint">Type the number. Press <b>EXP</b> to insert <b>×10</b> with a superscript power.</div>
      </div>
    `;
  }


  if (kind==="primeFactors" || answerType==="primeFactors"){
    // Visual box + hidden canonical string (uses ^ internally, never shown)
    return `
      <div class="pfwrap" aria-label="prime factorisation answer">
        <div class="pfbox" id="${baseId}Box" tabindex="0" aria-label="prime factorisation input"></div>
        <input id="${baseId}" type="hidden" value="" />
        <div class="keypad" data-target="${baseId}" data-exp="0">
          <button class="kbtn" data-prime="2">2</button>
          <button class="kbtn" data-prime="3">3</button>
          <button class="kbtn" data-prime="5">5</button>
          <button class="kbtn" data-prime="7">7</button>
          <button class="kbtn" data-prime="11">11</button>
          <button class="kbtn" data-prime="13">13</button>
          <button class="kbtn" data-act="times">×</button>
          <button class="kbtn accent" data-act="pow">^</button>
          <button class="kbtn" data-act="bksp">⌫</button>
          <button class="kbtn" data-act="clear">Clear</button>
        </div>
        <div class="pfhint">Tap primes. Use <b>^</b> for powers (not shown in the final display).</div>
      </div>
    `;
  }

  if (kind==="order" || answerType==="order"){
    // Drag-order widgets render inside the question text; nothing to render here.
    return ``;
  }

  if (kind==="money"){
    return `<input id="${baseId}" type="text" inputmode="decimal" placeholder="${addNoUnits("£")}" style="min-width:140px" />`;
  }

  if (kind==="int" || kind==="integer"){
    return `<input id="${baseId}" type="text" inputmode="numeric" placeholder="${defaultUnitPlaceholder()}" style="min-width:140px" />`;
  }

  return `<input id="${baseId}" type="text" inputmode="decimal" placeholder="${defaultUnitPlaceholder()}" style="min-width:160px" />`;
}


// -------------------- Module exports + helpers --------------------
function deepClone(obj){
  // structuredClone is supported in modern browsers; fallback to JSON clone.
  if(typeof structuredClone === "function"){
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

function prefixQuestionIds(question, prefix){
  const q = deepClone(question);
  const pfx = String(prefix || "q");
  q.instanceId = pfx;

  q.parts = (q.parts || []).map(part=>{
    if(part && part.input && part.input.id){
      part.input.id = `${pfx}__${part.input.id}`;
    }
    return part;
  });
  return q;
}

function ensureMarksSum(q){
  const sum = (q.parts || []).reduce((s,p)=>s + (p?.marks||0), 0);
  if(sum === q.marksTotal) return q;

  // Adjust marks defensively (should not usually happen)
  const parts = (q.parts || []).map(p=>({...p, marks: (p?.input ? 1 : 0)}));
  const sum2 = parts.reduce((s,p)=>s + (p?.marks||0), 0);
  let diff = q.marksTotal - sum2;

  // add remaining marks to the last input part
  if(diff !== 0){
    for(let i=parts.length-1;i>=0 && diff!==0;i--){
      if(parts[i]?.input){
        parts[i].marks += diff;
        diff = 0;
        break;
      }
    }
  }
  q.parts = parts;
  return q;
}
function generateQuestion({topicCode, marksTotal, paperMode, seed, instanceId}){
  const rng = makeRng(seed);
  let q = buildQuestion(topicCode, Number(marksTotal), paperMode, rng);
  q = ensureMarksSum(q);
  q.seed = rng.seed;
  q = prefixQuestionIds(q, instanceId || `${topicCode}_${marksTotal}_${paperMode}_${rng.seed}`);
  return q;
}

// -------------------- Rendering --------------------
function paperTagHtml(paperMode){
  return paperMode==="calc"
    ? `<span class="nc-tag calc">CALCULATOR</span>`
    : `<span class="nc-tag nc">NON‑CALCULATOR</span>`;
}
function renderQuestionHTML(q, opts={}){
  const topicName = (TOPICS.find(t=>t.code===q.topicCode)?.name ?? q.topicCode);
  const qNum = opts.questionNumber ? `Question ${opts.questionNumber}` : null;
  const title = qNum ? `${qNum} — ${q.topicCode}` : `${q.topicCode} — ${topicName}`;
  const badge = `<span class="badge">[${q.marksTotal} mark${q.marksTotal===1?"":"s"}]</span>`;

  let noteInserted = false;

  const itemsHtml = (q.parts || []).map((p,idx)=>{
    const rawText = (p?.textHtml ?? "");
    const inputHtmlRaw = renderInput(p?.input, p?.answer?.type, p?.input?.id || `p${idx}`, rawText);

    const hasInput = Boolean(inputHtmlRaw && String(inputHtmlRaw).trim() !== "");
    let inputHtml = inputHtmlRaw;

    if(hasInput && !noteInserted){
      const noteHtml = `<div class="unitnote">Do not include units in your answer.</div>`;
      inputHtml = noteHtml + inputHtml;
      noteInserted = true;
    }

    if(!hasInput){
      return `
        <div class="item">
          <div class="qtext">${rawText}</div>
        </div>
      `;
    }

    // If the question part contains a table, render the table full-width ABOVE the answer line.
    const m = rawText.match(/([\s\S]*?)(<table\s+class="qtable"[\s\S]*?<\/table>)([\s\S]*)/i);

    if(m){
      const before = m[1] ?? "";
      const tableHtml = m[2] ?? "";
      let after = m[3] ?? "";
      // remove leading <br> tags so the (a)/(b) line sits at the top next to the answer box
      after = after.replace(/^\s*(?:<br\s*\/?>\s*)+/i, "");

      return `
        <div class="item">
          <div class="qtext">${before}${tableHtml}</div>
          <div class="line">
            <div class="qtext">${after}</div>
            <div class="anscol">${inputHtml}</div>
          </div>
        </div>
      `;
    }

    return `
      <div class="item">
        <div class="line">
          <div class="qtext">${rawText}</div>
          <div class="anscol">${inputHtml}</div>
        </div>
      </div>
    `;
  }).join("");

  return `
    <div class="qpanel" data-q-instance="${q.instanceId || ""}">
      <div class="qhead">
        <h3>${title} ${badge}</h3>
        ${paperTagHtml(q.paperMode)}
      </div>
      <div class="qbody">
        ${itemsHtml}
      </div>
      <div class="qfoot">
        <div class="qscoreline" data-qscore></div>
      </div>
    </div>
  `;
}

// -------------------- Marking (container-scoped) --------------------
function cssEscapeSafe(id){
  if(typeof CSS !== "undefined" && CSS.escape) return CSS.escape(id);
  return String(id).replace(/[^a-zA-Z0-9_\-]/g, s => `\\${s}`);
}
function byId(container, id){
  if(!container) return null;
  return container.querySelector(`#${cssEscapeSafe(id)}`);
}

function clearMarks(container){
  if(!container) return;
  container.querySelectorAll("input,select,.dropbox,.dragbox").forEach(el=>{
    el.classList.remove("ok","bad");
  });
}
function markEl(el, ok){
  if(!el) return;
  el.classList.remove("ok","bad");
  el.classList.add(ok ? "ok" : "bad");
}

function getUserAnswerForPartIn(container, part){
  const id = part.input?.id;
  const type = part.answer?.type;

  if(!id) return {ok:false, val:null, els:[]};

  // Fraction
  if (part.input?.kind==="fraction" || type==="fraction"){
    const nEl = byId(container, id+"N");
    const dEl = byId(container, id+"D");
    const n = Number(nEl?.value);
    const d = Number(dEl?.value);
    if(!Number.isFinite(n)||!Number.isFinite(d)||d===0) return {ok:false, val:null, els:[nEl,dEl].filter(Boolean)};
    return {ok:true, val:{n, d}, els:[nEl,dEl].filter(Boolean)};
  }

  // Pair
  if (part.input?.kind==="pair" || type==="pair"){
    const aEl = byId(container, id+"A");
    const bEl = byId(container, id+"B");
    const a = asNum(aEl?.value);
    const b = asNum(bEl?.value);
    if(!Number.isFinite(a)||!Number.isFinite(b)) return {ok:false, val:null, els:[aEl,bEl].filter(Boolean)};
    return {ok:true, val:[a,b], els:[aEl,bEl].filter(Boolean)};
  }

  // Integer-only
  if (part.input?.kind==="integer"){
    const el = byId(container, id);
    const raw = (el?.value ?? "").trim();
    const x = asNum(raw);
    if(!Number.isFinite(x) || !Number.isInteger(x)) return {ok:false, val:null, els:[el].filter(Boolean)};
    return {ok:true, val:x, raw, els:[el].filter(Boolean)};
  }

  // Money / Number
  const el = byId(container, id);
  const raw0 = (el?.value ?? "").trim();
  const raw = raw0.replace(/^£\s*/,""); // mild forgiveness
  const x = asNum(raw);
  if(!Number.isFinite(x)) return {ok:false, val:null, els:[el].filter(Boolean)};
  return {ok:true, val:x, raw, els:[el].filter(Boolean)};
}
function markQuestion(container, question){
  if(!container || !question) return {score:0, max: question?.marksTotal ?? 0, partScores:[]};

  clearMarks(container);

  const dpUsedFromRaw = (raw)=>{
    const s = String(raw ?? "").trim().replace(/,/g, "");
    if(!s || !s.includes(".")) return 0;
    let frac = s.split(".")[1] ?? "";
    frac = frac.replace(/0+$/g, "");
    return frac.length;
  };

  let score = 0;
  const max = question.marksTotal;
  const partScores = [];

  for(const part of (question.parts || [])){
    const expected = part.answer;
    const pm = part.marks ?? 0;

    if(!expected || !part.input || pm===0){
      partScores.push(0);
      continue;
    }

    const got = getUserAnswerForPartIn(container, part);

    // Rounded-number marking with partial credit (deduct 1 mark for rounding issues).
    if(expected.type==="rounded"){
      let partScore = 0;

      if(Boolean(got.ok) && Number.isFinite(got.val)){
        const dp = Number(expected.dp);
        const correct = Number(expected.value);
        const unit = Math.pow(10, -dp);

        const roundsToCorrect = close(roundTo(got.val, dp), correct, Math.max(1e-9, unit/1000));
        const withinOneUnit = Math.abs(got.val - correct) <= (unit + 1e-9);

        if(roundsToCorrect){
          const dpUsed = dpUsedFromRaw(got.raw);
          const roundedDone = dpUsed <= dp;
          partScore = roundedDone ? pm : Math.max(0, pm - 1);
        } else if(withinOneUnit){
          partScore = Math.max(0, pm - 1);
        } else {
          partScore = 0;
        }

        if(got.els && got.els.length){
          got.els.forEach(el=>markEl(el, partScore===pm));
        }
      } else {
        if(got.els && got.els.length) got.els.forEach(el=>markEl(el,false));
        partScore = 0;
      }

      score += partScore;
      partScores.push(partScore);
      continue;
    }

    if(expected.type==="pair"){
      // Pair inputs: award full marks if both correct.
      // If the part is worth 2+ marks, award 1 mark for one correct entry.
      let partScore = 0;

      if(Boolean(got.ok) && Array.isArray(got.val) && got.val.length===2){
        const okA = close(got.val[0], expected.value[0], 1e-6);
        const okB = close(got.val[1], expected.value[1], 1e-6);

        if(got.els && got.els.length>=2){
          markEl(got.els[0], okA);
          markEl(got.els[1], okB);
        } else if(got.els && got.els.length){
          got.els.forEach(el=>markEl(el, okA && okB));
        }

        const correctCount = (okA?1:0) + (okB?1:0);

        if(correctCount === 2){
          partScore = pm;
        } else if(pm>=2 && correctCount === 1){
          partScore = 1;
        } else {
          partScore = 0;
        }
      } else {
        if(got.els && got.els.length) got.els.forEach(el=>markEl(el,false));
        partScore = 0;
      }

      score += partScore;
      partScores.push(partScore);
      continue;
    }

    // Default numeric / fraction marking
    let ok = false;

    if(!got.ok){
      ok = false;
    } else if(expected.type==="fraction"){
      ok = fracEq(got.val, expected.value);
    } else {
      ok = close(got.val, expected.value, Math.max(1e-9, Math.abs(expected.value)*1e-8));
    }

    if(got.els && got.els.length){
      got.els.forEach(el=>markEl(el, ok));
    }

    const partScore = ok ? pm : 0;
    score += partScore;
    partScores.push(partScore);
  }

  // Write per-question score line (if present)
  const line = container.querySelector("[data-qscore]");
  if(line){
    line.innerHTML = `<b>Score:</b> ${score} / ${max}`;
  }

  return {score, max, partScores};
}

// -------------------- Answers (for optional reveal) --------------------
function formatAnswerForPart(part){
  const ex = part.answer;
  if(!ex) return "";
  if(ex.type==="fraction"){
    return `${ex.value.n}/${ex.value.d}`;
  }
  if(ex.type==="pair"){
    return `(${ex.value[0]}, ${ex.value[1]})`;
  }
  if(ex.type==="rounded"){
    const dp = Number(ex.dp);
    if(Number.isFinite(dp)) return Number(ex.value).toFixed(dp);
    return String(ex.value);
  }
  if(part.input && part.input.kind==="money"){
    return "£" + Number(ex.value).toFixed(2);
  }
  return String(ex.value);
}
function getAnswerList(question){
  return (question.parts || [])
    .filter(p=>p && p.answer && p.marks>0)
    .map(p=>formatAnswerForPart(p));
}


// -------------------- Browser globals --------------------
(function(global){
  try{
    global.QuestionBank = {
      BANK_TOPICS: TOPICS,
      makeRng,
      cryptoSeed,
      generateQuestion,
      renderQuestionHTML,
      markQuestion,
      getAnswerList
    };
  }catch(e){
    console.error("QuestionBank failed to initialise:", e);
  }
})(typeof window!=="undefined" ? window : globalThis);
