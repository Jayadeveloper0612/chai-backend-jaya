import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import JWT from "jsonwebtoken"

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    //  user find
    const user = await User.findById(userId)

    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    )
  }
}

//* ..********************* REGISTER USER *******************.. */
const registerUser = asyncHandler(async (req, res) => {
  // ## 1) get user details from frontend
  const { fullName, userName, email, password } = req.body
  // console.log("data : ", req.body)

  // ## 2) validation - not empty
  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required")
  }

  // ## 3) check if user already exists : username , email
  const existedUser = await User.findOne({ $or: [{ userName }, { email }] })
  if (existedUser) {
    throw new ApiError(409, "User with email or username already exist!")
  }

  // ## 4) check for images, check for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path
  // const coverImageLocalPath = req.files?.coverImage[0]?.path
  // console.log("req.files : ", req.files)

  let coverImageLocalPath
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }
  // ## 5) upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar) {
    throw new ApiError(400, "Avatar is required")
  }

  // ## 6) create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  })

  // ## 7) remove password and refresh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  // ## 8) check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  // ## 9) return response
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User Registered Successfully!"))
})

//* ..********************* LOGIN USER *******************.. */
const loginUser = asyncHandler(async (req, res) => {
  // ## 1) reg body -> get data
  const { email, password, userName } = req.body

  // ## 2) check username and email
  if (!userName && !email) {
    throw new ApiError(400, "username or email is required")
  }

  // ## 3) fint the user
  const user = await User.findOne({ $or: [{ userName }, { email }] })
  if (!user) {
    throw new ApiError(404, "User does not exist")
  }

  // ## 4) password check
  const isPasswordValid = await user.isPasswordCorrect(password)
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials")
  }

  // ## 5) generate access and refresh token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  )

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )
  // ## 6) send cookie
  const options = { httpOnly: true, secure: true }
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully!"
      )
    )
})

//* ..********************* LOGOUT USER *******************.. */
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  )

  const options = { httpOnly: true, secure: true }
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully!"))
})

//* ..********************* SESSION *******************.. */
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken

  if (incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request")
  }

  try {
    //verify
    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    )

    //find user
    const user = await User.findById(decodedToken?._id)
    if (!user) {
      throw new ApiError(401, "invalid refresh token")
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }

    const options = {
      httpOnly: true,
      secure: true,
    }

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id)

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access Token refreshed"
        )
      )
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token")
  }
})

export { registerUser, loginUser, logoutUser, refreshAccessToken }
