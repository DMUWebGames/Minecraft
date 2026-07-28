import { db } from "../db.js";

db.exec(`
    CREATE TABLE IF NOT EXISTS games (
        id string PRIMARY KEY,
        data string
    )
`)