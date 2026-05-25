import { MongoClient, type Db } from "mongodb"

const uri = process.env.MONGODB_URI || ""

if (!uri) {
  console.error("[MongoDB] KRITIK: MONGODB_URI environment variable yo'q!")
}

const globalWithMongo = global as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

function createClientPromise(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(
      new Error("MONGODB_URI environment variable aniqlanmagan. Vercel Dashboard > Settings > Environment Variables ga qo'shing.")
    )
  }

  // URI ni HECH QACHON encode qilmaymiz - encodeURIComponent underscore va
  // boshqa belgilarni buzib Atlas ulanishni ishlamay qoldiradi
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    socketTimeoutMS: 15000,
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 5,
    minPoolSize: 0,
  })

  return client.connect()
}

function getClientPromise(): Promise<MongoClient> {
  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI environment variable aniqlanmagan."))
  }

  if (!globalWithMongo._mongoClientPromise) {
    globalWithMongo._mongoClientPromise = createClientPromise().catch((err) => {
      delete globalWithMongo._mongoClientPromise
      throw err
    })
  }
  return globalWithMongo._mongoClientPromise
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const client = await getClientPromise()
  const dbName = uri.split("/").pop()?.split("?")[0] || "just_habits"
  const db = client.db(dbName)
  return { client, db }
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase()
  return db
}

const clientPromise: Promise<MongoClient> = getClientPromise()
export default clientPromise
