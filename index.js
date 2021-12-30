const accounting = require('accounting')
const csv = require('csv-string')
const Decimal = require('decimal.js')
const fs = require('fs')

async function getTransactions(path) {
  const str = await fs.promises.readFile(path, 'utf8')
  const records = csv.parse(str)
  return records.map(rec => ({
    datetime: getDate(rec[4]),
    amount: parseFloat(rec[6]),
    currency: rec[7],
    text: rec[9]
  })).filter(isPositiveRurExpense)

  function getDate(s) {
    // transforms dd.MM.yyyy hh:mm into yyyy.MM.dd
    return `${s[6]}${s[7]}${s[8]}${s[9]}.${s[3]}${s[4]}.${s[0]}${s[1]}`
  }

  function isPositiveRurExpense(tran) {
    return tran.currency === "RUR" && tran.amount > 0
  }
}

function createReport(trans) {
  // these rules are subjective and may not work for you
  // I wrote them based on my data
  const categories = {
    "junk food": [
      "MCDONALDS", "BURGER KING", "BURGERKING", "BK BURGER", "KFC", "SHAURMA", "ZHAR-PICCA", "ZHAR-PITSTSA", "KUBA",
      "CUBA"
    ],
    coffee: ["KOFEMOLL", "DONUT", "DONUT BAR", "COFFE WAY", "COFFE", "BLACK CUP 72"],
    cars: ["KHENDE", "AZS", "AVTOSTIL", "BI-BI", "AVTOM-KA CHERNAYA KOSH"],
    caffee: [
      "SHOKOLADNICA", "TORROGRILL BAR", "UTKA", "RESTORAN", "MANDARINOVYJ GUS", "LAPSHA 4B", "PAB THE COCK",
      "ITALYANSKOE KAFE", "STARIK KHINKALYCH", "MONE 33", "BRAUNI ZHILLOJ MASSIV", "BYKOVSKIJ", "RAKDILER"
    ],
    cats: ["BETKHOVEN 60", ".EKZOTIKA.", "ZOOMAGAZIN"],
    devices: ["APPLE ONLINE STORE", "DNS", "MVIDEO", "SITILINK"],
    "movies-offline": ["SINEMA 5", "LUKSOR", "GRINNFILM", "SINEMA 46", "KASSA.RAMBLER2", "KASSARAMBLERRBS", "KINOHOD113"],
    "movies-online": ["KINOPOISK", "YANDEX.PLUS", "IVI.RU", "YOUTUBE", "NETFLIX"],
    education: ["EDUCATION"],
    look: ["HENDERSON", "TOM TAILOR", "SPORTMASTER", "OSTIN", "LAMODA", "SNOW QUEEN", "BIG BRO"],
    "food delivery": ["DELIVERY CLUB", "VKUSVILL"],
    food: ["PEREKRESTOK", "PYATEROCHKA", "GM EVROPA", "EVROPA", "GIPERMARKET", "MAGNIT", "BILLA"],
    medical: ["APTEKA", "MEDASSIST", "APTECHNYJ PUNKT", "TABLETOCHKA"],
    tools: ["JETBRAINS", "WORKFLOWY", "OBSIDIAN", "DIGITALOCEAN"],
    travel: ["AIRBNB", "BOOKING.COM", "RZD", "KUPIBILET", "TUTU.RU", "RUSLINE"],
    taxi: ["YANDEX.TAXI"],
    cash: ["ATM", "KVT", "VB24"],
    english: ["PAYPAL", "YANDEKS.PRAKTIMUM"]
  }

  const known = {}
  let unknowns = []
  let knownTotal = new Decimal(0)
  let unknownTotal = new Decimal(0)

  for (const tran of trans) {
    const category = getCategory(tran)
    if (category) {
      knownTotal = knownTotal.plus(tran.amount)
      let recs = known[category]
      if (recs) {
        known[category] = recs.plus(tran.amount)
      } else {
        known[category] = new Decimal(tran.amount)
      }
    } else {
      unknownTotal = unknownTotal.plus(tran.amount)
      unknowns.push(tran)
    }
  }

  const knownCategories = []
  for (const name in known) {
    const total = known[name]
    knownCategories.push({ name, total: parseFloat(total) })
  }

  return {
    known: { total: knownTotal, categories: knownCategories },
    unknown: { total: unknownTotal, transactions: unknowns }
  }

  function getCategory(tran) {
    let tranCategory = null
    for (const category in categories) {
      const keys = categories[category]
      for (const key of keys) {
        if (tran.text.includes(key)) {
          if (tranCategory != null) {
            // this is an ambiguous transaction, and we don't know the category for sure
            return null
          } else {
            tranCategory = category
          }
        }
      }
    }

    return tranCategory
  }
}

function printReport({ known, unknown }) {
  const { total: knownTotal, categories } = known
  console.log(`Known total: ${formatMoney(knownTotal)}`)
  categories.sort(sortByTotalDesc);
  categories.forEach(printCategory)

  const { total: unknownTotal, transactions: unknownTransactions } = unknown
  console.log(`\nUnknown transactions: ${formatMoney(unknownTotal)}`)
  unknownTransactions.sort(sortByAmountDesc);
  unknownTransactions
    .filter(tran => tran.amount > 2500) // this is useful for debugging when you need to update rules
    .forEach(printUnknownTransaction)

  function printCategory(category) {
    console.log(`${formatMoney(category.total)} ${category.name}`)
  }

  function printUnknownTransaction(tran) {
    console.log(`${formatMoney(tran.amount)} ${tran.datetime} ${tran.text}`)
  }

  function formatMoney(amountInRubles) {
    return accounting.formatMoney(amountInRubles, "₽", 0)
  }

  function sortByTotalDesc(a, b) {
    return a.total > b.total ? -1 : 1;
  }

  function sortByAmountDesc(a, b) {
    return a.amount > b.amount ? -1 : 1;
  }
}

// If you are an Avangard bank user you may download CSV report and use the script to analyze your expenses
// please convert the file to utf8 manually before parsing
getTransactions('/Users/andrew/Downloads/AccStat.csv').then(trans => printReport(createReport(trans)))
