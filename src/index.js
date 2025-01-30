import dotenv from "dotenv";
import colors from "colors";
import connectDB from "./config/db.js";
// import app from "./app.js";
import { app } from "./app.js";

dotenv.config({ path: "./env" });

const PORT = process.env.PORT || 8001;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n Server is running at PORT : ${PORT}`.bgGrey.white);
    });
  })
  .catch((err) => {
    console.log("MONGO DB Connection Failed !!! ", err);
  });
