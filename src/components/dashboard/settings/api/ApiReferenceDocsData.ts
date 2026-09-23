export const getCurlCode = (host: string, displayKey: string) => ({
  services: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=services"`,
  
  add: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=add" \\
  -d "service=15" \\
  -d "link=https://t.me/durov" \\
  -d "quantity=100"`,
  
  status: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=status" \\
  -d "order=104"`,
  
  balance: `curl -X POST "${host}/api/v2" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "key=${displayKey}" \\
  -d "action=balance"`
});

export const getNodeCode = (host: string, displayKey: string) => ({
  services: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'services'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  add: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'add',
    service: '15',
    link: 'https://t.me/durov',
    quantity: '100'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  status: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'status',
    order: '104'
  })
})
.then(res => res.json())
.then(console.log);`,
  
  balance: `fetch('${host}/api/v2', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    key: '${displayKey}',
    action: 'balance'
  })
})
.then(res => res.json())
.then(console.log);`
});

export const jsonResponse = {
  services: `[
  {
    "service": 15,
    "name": "Подписчики Telegram (Эконом)",
    "type": "Default",
    "category": "Подписчики",
    "rate": "0.0300",
    "min": 10,
    "max": 50000
  },
  {
    "service": 18,
    "name": "Просмотры постов Telegram (Быстрые)",
    "type": "Default",
    "category": "Просмотры",
    "rate": "0.0020",
    "min": 100,
    "max": 1000000
  }
]`,
  
  add: `{
  "order": 1284
}`,
  
  status: `{
  "charge": "0.3000",
  "start_count": "0",
  "status": "In progress",
  "remains": "85",
  "currency": "RUB"
}`,
  
  balance: `{
  "balance": "1540.2300",
  "currency": "RUB"
}`
};
