// Field-level rules the Base44 schemas could not express. Row rules decide
// WHO may write a record; these decide WHICH fields a non-admin may set, so
// an owner cannot approve, feature, verify or boost their own listing by
// calling the API directly. Admins and the server's own functions skip them.

const keep = (prev, key) => (prev ? prev[key] : undefined);

// Fields an owner may only reset (to a value like false/0/"PENDING"), never raise.
const PROPERTY_ADMIN_ONLY = [
  'approved_by_id', 'approved_by_name', 'approved_date', 'trust_score', 'trust_breakdown', 'verification_level',
  'external_inspection_pending', 'inspection_report_url', 'poster_plan_override', 'boost_active', 'boost_ends_date',
  'boost_count', 'tour_3d_set_date',
];

function guardProperty(data, { prev, user, db }) {
  const out = { ...data };
  for (const k of PROPERTY_ADMIN_ONLY) {
    if (k in out) {
      if (prev) out[k] = keep(prev, k);
      else delete out[k];
    }
  }
  if ('approval_status' in out && out.approval_status !== 'PENDING') {
    if (prev) out.approval_status = prev.approval_status;
    else out.approval_status = 'PENDING';
  }
  for (const k of ['featured', 'owner_verified', 'ai_tour_verified']) {
    if (k in out && out[k] && !(prev && prev[k])) out[k] = prev ? prev[k] : false;
  }
  if ('views_count' in out) out.views_count = prev ? prev.views_count : 0;
  // The plan badge must match a plan the poster actually pays for.
  if ('poster_plan' in out && out.poster_plan && out.poster_plan !== keep(prev, 'poster_plan')) {
    const paid = db.all('Subscription').some((s) => s.user_id === user?.id && s.plan_id === out.poster_plan && s.status === 'active');
    if (!paid) out.poster_plan = prev ? prev.poster_plan : null;
  }
  return out;
}

function guardRating(data, { prev, user }) {
  const out = { ...data };
  if ('is_verified' in out) out.is_verified = prev ? prev.is_verified : false;
  // The person reviewed may answer, not rewrite the review.
  if (prev && user && prev.target_user_id === user.id && prev.reviewer_user_id !== user.id) {
    return Object.fromEntries(Object.entries(out).filter(([k]) => ['owner_reply', 'owner_reply_date'].includes(k)));
  }
  return out;
}

function guardMessage(data, { prev, user }) {
  // The recipient may mark a message read; only the sender may change it.
  if (prev && user && prev.recipient_id === user.id && prev.sender_id !== user.id) {
    return 'read_at' in data ? { read_at: data.read_at } : {};
  }
  return data;
}

function guardReport(data, { prev }) {
  if (prev) return data; // updates are admin-only by row rule
  const { status, resolution_note, resolved_by_id, resolved_by_name, resolved_date, auto_action, ...rest } = data;
  return rest;
}

export const FIELD_GUARDS = {
  Property: guardProperty,
  Rating: guardRating,
  Message: guardMessage,
  Report: guardReport,
};

// Updates anyone signed in may make to someone else's record.
export const OPEN_UPDATES = {
  Comment: ['likes'],
};
