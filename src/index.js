import dotenv from "dotenv";
import colors from "colors";
import connectDB from "./config/db.js";

dotenv.config({ path: "./env" });

connectDB();
