import { join } from 'node:path'

// Side-effect free so CLI commands (restore) can use them without opening the database
export const DATA_DIR = process.env.DATA_DIR ?? 'data'
export const UPLOAD_DIR = join(DATA_DIR, 'uploads')
export const CACHE_DIR = join(DATA_DIR, 'cache')
export const DB_FILE = process.env.DATABASE ?? join(DATA_DIR, 'cms.db')
