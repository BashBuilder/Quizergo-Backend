// import "dotenv/config";
// import { alocApi } from "../config/axios.js";
// import { supportedSubjects } from "../lib/constants.js";
// import axios, { AxiosError } from "axios";
// import { handleFunctionError, ValidationError } from "../lib/errors.js";

// export class AlocQuestionService {
//   constructor() {}

//   async getQuestionsBySubject(subject: string, limit: number = 10) {
//     try {
//       if (!supportedSubjects.includes(subject.toLowerCase())) {
//         throw new ValidationError(
//           `Subject "${subject}" is not supported. Supported subjects are: ${supportedSubjects.join(", ")}`,
//         );
//       }
//       const url = `/q/${limit}?subject=${subject}`;
//       const response = await alocApi.get<{
//         subject: string;
//         status: number;
//         data: AlocQuestionType[];
//       }>(url);
//       return response.data;
//     } catch (error: any) {
//       handleFunctionError(error, "fetching questions from ALOC");
//     }
//   }

//   async getSubjectCount(subject: string) {
//     try {
//       if (!supportedSubjects.includes(subject.toLowerCase())) {
//         throw new Error(
//           `Subject "${subject}" is not supported. Supported subjects are: ${supportedSubjects.join(", ")}`,
//         );
//       }
//       const url = `/metrics/questions-available-for/${subject}`;
//       const response = await alocApi.get<{
//         message: string;
//         status: string;
//         data: { questions: number; subject: string };
//       }>(url);
//       return response.data.data;
//     } catch (error) {
//       handleFunctionError(error, "Fetching all question counts from ALOC");
//     }
//   }
// }
