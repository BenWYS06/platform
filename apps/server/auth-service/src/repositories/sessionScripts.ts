// Job: Lua sources for the session writes (plan 012b D2, D4, D5). Every write first checks
// that the session hash exists, so no write recreates a hash without a TTL (spec 012 "Must not
// happen"). HSET and HINCRBY on an existing key keep its TTL.
// Field names match SESSION_FIELD in sessions.ts and contracts/messaging.json.

// KEYS[1] sess:{sid}. ARGV[1] reason, ARGV[2] expected userId ('' = any).
// Returns 1 when this call revoked the session, else 0 (missing, other user, already revoked).
export const REVOKE_ONE = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local f = redis.call('HMGET', KEYS[1], 'userId', 'revoked')
if ARGV[2] ~= '' and f[1] ~= ARGV[2] then return 0 end
if f[2] == '1' then return 0 end
redis.call('HSET', KEYS[1], 'revoked', '1', 'revokedReason', ARGV[1])
return 1
`;

// KEYS[1] user:{userId}:sessions. ARGV[1] session key prefix ('sess:'), ARGV[2] reason.
// Session keys are built here, not passed in KEYS: fine on one Redis node (D5).
// Sids whose hash is gone are removed from the set. Returns how many sessions it revoked.
export const REVOKE_ALL_OF_USER = `
local n = 0
for _, sid in ipairs(redis.call('SMEMBERS', KEYS[1])) do
  local key = ARGV[1] .. sid
  if redis.call('EXISTS', key) == 0 then
    redis.call('SREM', KEYS[1], sid)
  elseif redis.call('HGET', key, 'revoked') ~= '1' then
    redis.call('HSET', key, 'revoked', '1', 'revokedReason', ARGV[2])
    n = n + 1
  end
end
return n
`;

// KEYS[1] user:{userId}:sessions. ARGV[1] session key prefix ('sess:').
// Adds 1 to claimsVersion of each live session; skips revoked ones; removes sids whose hash
// is gone. Returns how many sessions it changed.
export const MARK_CLAIMS_STALE = `
local n = 0
for _, sid in ipairs(redis.call('SMEMBERS', KEYS[1])) do
  local key = ARGV[1] .. sid
  if redis.call('EXISTS', key) == 0 then
    redis.call('SREM', KEYS[1], sid)
  elseif redis.call('HGET', key, 'revoked') ~= '1' then
    redis.call('HINCRBY', key, 'claimsVersion', 1)
    n = n + 1
  end
end
return n
`;
