import baseAPI from "./api";

export interface CategoriesResponse {
  success: boolean;
  data: string[];
}

export const getFaqCategories = async (): Promise<CategoriesResponse> => {
  const res = await baseAPI.get("/api/faqs/categories");
  return res.data;
};