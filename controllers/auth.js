import { Router } from "express";
import { body, validationResult } from "express-validator";
import { v4 as uuidv4 } from "uuid";
import {
  isThisAdmin,
  isUserExist,
  passwordHasher,
  tokenExtractor,
  tokenGenerator,
} from "../utils/authHelpers.js";
import {
  badRequest,
  notFound,
  sendResponse,
  serverError,
} from "../utils/serverResponse.js";
import Auth from "../models/auth.js";
import bcrypt from "bcryptjs";
import multer from "multer";
import render from "xlsx";
import StudentsFile from "../models/tempStudents.js";

const router = Router();

router.post("/checkRoleNum", async (req, res) => {
  try {
    const { roleNo } = req.body;
    const result = await StudentsFile.findOne({ roleNo });
    if (!result) {
      return res.status(404).send("role num not found!");
    }
    res.send(result);
  } catch (error) {
    res.send(error);
  }
});
router.post("/signup", async (req, res) => {
  try {
    let { roleNo, cnic, email, password } = req.body;
    const result = await Auth.findOne({ roleNo });
    const result2 = await Auth.findOne({ email });
    if (result || result2) {
      return res.status(401).send({
        message: "user already exist with this role number or email",
        success: true,
      });
    }
    password = passwordHasher(password);
    const user = new Auth({ roleNo, cnic, email, password });
    await user.save();
    res
      .status(201)
      .send({
        message: "User Has Been Created Successfully",
        success: true,
        token: tokenGenerator(user),
      });
  } catch (error) {
    res.send(error);
  }
});

// ROUTE : 1 POST SIGN UP
// router.post(
//   "/signup/",
//   [
//     //validation
//     body("cnic", "CNIC is required").notEmpty(),
//     body("rollNo", "Roll No. is required").notEmpty(),
//     body("email", "Enter Valid Email").isEmail(),
//     body("password", "Password must be 6 letter long").isLength({ min: 6 }),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty) {
//       return badRequest(res, { error: errors.array() });
//     }
//     try {
//       const { name, email, password, rollNo, cnic } = req.body;
//       let user = await Auth.findOne({ $and: { cnic, rollNo } });
//       if (!user) {
//         return badRequest(res, {
//           error: "Contact your admin, you are not added",
//         });
//       }

//       user = await Auth.findOne({ email: email });
//       if (user) {
//         return badRequest(res, { error: "Email Already Exist" });
//       }

//       user = await Auth.create({
//         name,
//         email,
//         cnic,
//         rollNo,
//         password: passwordHasher(password),
//         uniqueId: uuidv4(),
//       });

//       res.status(201).send({ token: tokenGenerator(user) });
//     } catch (error) {
//       return serverError(error, res);
//     }
//   }
// );

// ROUTE : 2 POST Sign In
// router.post(
//   "/signin",
//   [
//     //validation
//     body("email", "Enter Valid Email").isEmail(),
//     body("password", "Password is required").notEmpty(),
//   ],
//   async (req, res) => {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return badRequest(res, { error: errors.array()[0].msg });
//     }
//     try {
//       const { email, password } = req.body;

//       // function for login logic
//       let user = await Auth.findOne({ email });
//       if (!user) {
//         return badRequest(res, { error: "Credentials Not Found" });
//       }
//       if (user.isAdmin) {
//         return badRequest(res, { error: "Credentials not found" });
//       }
//       let userPassword = user.password;
//       const comparePassWord = await bcrypt.compare(password, userPassword);
//       if (!comparePassWord) {
//         return badRequest(res, { error: "Credentials Not Found" });
//       }
//       res.status(201).send({ token: tokenGenerator(user) });
//     } catch (error) {
//       return serverError(error, res);
//     }
//   }
// );

// ROUTE : 3 POST Update Password
router.post(
  "/updatePassword",
  tokenExtractor,
  [
    //validation
    body("password", "Password must be 6 letter long").notEmpty(),
    body("confirmPassword", "Password must be 6 letter long").isLength({
      min: 6,
    }),
    body("updatePassword", "Password must be 6 letter long").isLength({
      min: 6,
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, { error: errors.array()[0].msg });
    }

    try {
      const { password, updatePassword } = req.body;
      const userId = req.user.id;
      const user = await Auth.findById(userId).select({ password: 1 });
      const oldPassword = user.password;
      const comparePassWord = await bcrypt.compare(password, oldPassword);
      if (comparePassWord) {
        const newPassword = passwordHasher(updatePassword);
        const result = await Auth.updateOne(
          { _id: userId },
          { $set: { password: newPassword } }
        );
        return res.json(result);
      }
      return res.status(401).json({ error: "Old Password Is Wrong" });
    } catch (error) {
      serverError(error, res);
    }
  }
);

// ROUTE : 4 POST update Profile
router.post(
  "/manageProfile",
  tokenExtractor,
  [
    //validation
    body("name", "Name is Required").isLength({ min: 6 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty) {
      badRequest(res, { error: errors.array() });
    }

    try {
      const {
        body: { name },
        user,
      } = req;
      let manageUser = await isUserExist(res, user.email);
      manageUser.name = name;
      await manageUser.save();
      sendResponse(res, 201, { data: manageUser });
    } catch (error) {
      serverError(error, res);
    }
  }
);

// ROUTE : 5 POST addAdmin
router.post(
  "/addAdmin",
  tokenExtractor,
  isThisAdmin,
  [
    //validation
    body("email", "Enter Valid Email").isEmail(),
    body("password", "Password must be 6 letter long").isLength({ min: 6 }),
    body("name", "Name is Required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty) {
      return badRequest(res, { error: errors.array() });
    }
    try {
      const { name, email, password, cnic } = req.body;
      let user = await Auth.findOne({ email: email });

      if (user) {
        return badRequest(res, { error: "Email Already Exist" });
      }
      user = await Auth.create({
        name,
        email,
        cnic,
        password: passwordHasher(password),
        uniqueId: uuidv4(),
        isAdmin: true,
      });
      res.status(201).send({ message: "Add Admin Successfully" });
    } catch (error) {
      return serverError(error, res);
    }
  }
);
// ROUTE : 6 get user details
router.get("/getUser/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    let user = await Auth.findById(userId)
      .populate("appliedCourses")
      .populate("enrolledCourses")
      .exec();
    if (!user) {
      return notFound(res, { error: "User Not Found" });
    }
    return sendResponse(res, 200, { user });
  } catch (error) {
    return serverError(error, res);
  }
});

router.post(
  "/addStudent",
  tokenExtractor,
  isThisAdmin,
  multer().single("studentsFile"),
  async (req, res) => {
    const file = render.read(req.file.buffer);
    const sheets = file.SheetNames;
    const data = [];

    for (let i = 0; i < sheets.length; i++) {
      const sheetName = sheets[i];
      const sheetData = render.utils.sheet_to_json(file.Sheets[sheetName]);
      for (let j = 0; j < sheetData.length; j++) {
        const user = await StudentsFile.findOne({ roleNo: sheetData[j].roleNo })
          .select("_id")
          .lean();
        if (!user) {
          data.push(sheetData[j]);
        }
      }
    }
    const result = await StudentsFile.insertMany(data);

    res.json(result);
  }
);

// ROUTE : 7 admin adding user with roll no and cnic
// router.post(
//   "/addStudent",
//   upload.single("studentDetails"),
//   async (req, res) => {
//     try {
//       // var tmp_path = req.files.studentDetails.path;
//       // console.log(tmp_path);
//       // var target_path = "uploads/" + req.files.recfile.name;
//       let fileData;
//       fs.readFile(tmp_path, (err, data) => {
//         console.log(data);
//         fileData = data;
//       });
//       console.log(fileData);

//       // const data = [];

//       // for (let i = 0; i < sheets.length; i++) {
//       //   const sheetName = sheets[i];
//       //   const sheetData = render.utils.sheet_to_json(file.Sheets[sheetName]);
//       //   sheetData.forEach((singleData) => {
//       //     data.push(singleData);
//       //   });
//       // }

//       // console.log(data);

//       let user = await Auth.findOne({ $or: { cnic, rollNo } });
//       if (user) {
//         return badRequest(res, { error: "User Already Added" });
//       }
//       user = await Auth.create({
//         cnic,
//         rollNo,
//         name: undefined,
//         email: undefined,
//         password: undefined,
//         uniqueId: uuidv4(),
//       });
//       sendResponse(res, 200, { message: "User Added Successfully" });
//     } catch (error) {
//       return serverError(error, res);
//     }
//   }
// );

// ROUTE : 2 POST Sign In
router.post(
  "/signin",
  [
    //validation
    body("email", "Enter Valid Email").isEmail(),
    body("password", "Password is required").notEmpty(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return badRequest(res, { error: errors.array()[0].msg });
    }
    try {
      const { email, password } = req.body;

      // function for login logic
      let user = await Auth.findOne({ email });
      if (!user) {
        return badRequest(res, { error: "Credentials Not Found" });
      }
      let userPassword = user.password;

      const comparePassWord = await bcrypt.compare(password, userPassword);
      if (!comparePassWord) {
        return badRequest(res, { error: "Credentials Not Found" });
      }
      res.status(201).send({ token: tokenGenerator(user) });
    } catch (error) {
      return serverError(error, res);
    }
  }
);

export default router;