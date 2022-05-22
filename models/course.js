import mongoose from "mongoose";

const CourseScehma = new mongoose.Schema({
  title: { type: String, required: true, unique: true },
  status: { type: Boolean, default: true },
  appliedStudents: [{ type: mongoose.Types.ObjectId, ref: "auth" }],
  timeStamp: { type: Date, default: Date.now() },
  // enrolledStudent: [{ type: mongoose.Types.ObjectId, ref: "auth" }],
  // duration: { type: Number, required: true }, //In Month
});

const Course = mongoose.model("course", CourseScehma);

// Course.createIndexes();
export default Course;
