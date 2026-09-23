-- src/lib/security/scripts/rate-limit.lua
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local unique_id = ARGV[4]

-- 1. Clean old records outside the sliding window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- 2. Count current hits in sliding window
local current = redis.call('ZCARD', key)

if current < limit then
  -- 3. Add new hit with score = now
  redis.call('ZADD', key, now, unique_id)
  -- 4. Set TTL in seconds
  local ttlSeconds = math.ceil(window / 1000)
  if ttlSeconds < 1 then ttlSeconds = 1 end
  redis.call('EXPIRE', key, ttlSeconds)
  return 1 -- Allowed
else
  return 0 -- Blocked
end
