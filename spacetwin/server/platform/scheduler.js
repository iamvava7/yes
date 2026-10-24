// The website's workflows (site/base44/workflows/*.jsonc): scheduled ones run
// on their cron expression (UTC), entity ones when a record of that entity is
// created / updated / deleted. Each step that calls a backend function runs it.

function cronField(expr, value, min, max) {
  return expr.split(',').some((part) => {
    const [range, stepS] = part.split('/');
    const step = stepS ? Number(stepS) : 1;
    let lo = min, hi = max;
    if (range !== '*') {
      const [a, b] = range.split('-').map(Number);
      lo = a;
      hi = Number.isFinite(b) ? b : stepS ? max : a;
    }
    return value >= lo && value <= hi && (value - lo) % step === 0;
  });
}

export function cronMatches(expr, date) {
  const f = String(expr).trim().split(/\s+/);
  if (f.length !== 5) return false;
  const [mi, h, dom, mon, dow] = f;
  return cronField(mi, date.getUTCMinutes(), 0, 59) && cronField(h, date.getUTCHours(), 0, 23)
    && cronField(dom, date.getUTCDate(), 1, 31) && cronField(mon, date.getUTCMonth() + 1, 1, 12)
    && (cronField(dow, date.getUTCDay(), 0, 7) || (date.getUTCDay() === 0 && cronField(dow, 7, 0, 7)));
}

function steps(wf) {
  return (wf.definition?.do ?? []).flatMap((s) => Object.values(s))
    .filter((s) => s?.call === 'invoke_backend_function' && s.with?.function_name);
}

export function createScheduler({ workflows, entities, functions, log = console.log }) {
  let timer = null;
  let lastMinute = -1;

  async function runWorkflow(wf, extra = {}) {
    for (const s of steps(wf)) {
      try {
        const out = await functions.call(s.with.function_name, { ...(s.with.args || {}), ...extra }, { system: true });
        if (out?.error) log(`[workflow] ${wf.name}: ${s.with.function_name} → ${out.error}`);
      } catch (e) {
        log(`[workflow] ${wf.name}: ${s.with.function_name} failed: ${e.message}`);
      }
    }
  }

  const scheduled = workflows.filter((w) => w.trigger?.config?.trigger_type === 'scheduled' && w.trigger.config.cron_expression);
  const onEntity = workflows.filter((w) => w.trigger?.config?.trigger_type === 'entity');

  // Entity triggers run after the write that caused them, never inside it.
  entities.bus.on('change', (e) => {
    for (const wf of onEntity) {
      const c = wf.trigger.config;
      if (c.entity_name !== e.entity || !(c.events || []).includes(e.type)) continue;
      setImmediate(() => runWorkflow(wf, { event: { type: e.type, entity_name: e.entity, entity_id: e.id }, data: e.data }));
    }
  });

  function tick(now = new Date()) {
    const minute = Math.floor(now.getTime() / 60_000);
    if (minute === lastMinute) return [];
    lastMinute = minute;
    const due = scheduled.filter((w) => cronMatches(w.trigger.config.cron_expression, now));
    due.forEach((w) => runWorkflow(w));
    return due.map((w) => w.name);
  }

  return {
    workflows,
    runWorkflow,
    tick,
    start() {
      if (!timer && scheduled.length) {
        timer = setInterval(() => tick(), 20_000);
        timer.unref();
      }
    },
    stop() { clearInterval(timer); timer = null; },
  };
}
