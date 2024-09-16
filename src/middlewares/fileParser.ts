import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { fileSizeLimit } from "../libs/constants";

const storage = multer.memoryStorage();

const uploader = multer({
  storage: storage,
  limits: { fileSize: fileSizeLimit },
});

export function parseFiles(fieldName: string, isSingle: boolean) {
  return function uploadFile(req: Request, res: Response, next: NextFunction) {
    let upload;

    if (isSingle) upload = uploader.single(fieldName);
    else upload = uploader.array(fieldName);

    upload(req, res, function (err: any) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json(err);
      } else if (err) {
        return res.status(400).json("Error has occured.");
      }
      next();
    });
  };
}
