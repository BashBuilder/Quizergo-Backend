import "dotenv/config";
import { alocApi } from "../config/axios.js";
import { supportedSubjects } from "../lib/constants.js";

export class AlocQuestionService {
  async getQuestionsBySubject(subject: string, limit: number = 10) {
    try {
      if (!supportedSubjects.includes(subject.toLowerCase())) {
        throw new Error(
          `Subject "${subject}" is not supported. Supported subjects are: ${supportedSubjects.join(", ")}`,
        );
      }
      const url = `/q/${limit}?subject=${subject}`;
      const response = await alocApi.get<{
        subject: string;
        status: number;
        data: AlocQuestionType[];
      }>(url);
      return response.data;
    } catch (error: any) {
      console.log("Error fetching questions from ALOC:", error);
      throw new Error(error.message || "Failed to fetch questions from ALOC");
    }
  }
}
