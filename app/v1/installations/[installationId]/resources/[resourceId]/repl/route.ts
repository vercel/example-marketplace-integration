import { deleteResource, getResource, updateResource } from "@/lib/partner";
import { readRequestBodyWithSchema } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";
import { updateResourceRequestSchema } from "@/lib/vercel/schemas";
import { headers } from "next/headers";

interface Params {
  installationId: string;
  resourceId: string;
}

interface PostResourceREPLRequestBody {
  input: string;
}

interface PostResourceREPLResponseBody {
  result: Block[];
}

// Some simple, standard block library (does Vercel have an existing implementation?)

interface TextBlock {
  type: "text";
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  href?: string; // Turn the text into a clickable link to this href
}

interface ParagraphBlock {
  type: "paragraph";
  children: TextBlock[];
}

interface TableBlock {
  type: "table";
  header?: TextBlock[];
  rows: TextBlock[][];
}

type Block = ParagraphBlock | TableBlock;

export const POST = async (
  request: NextRequest,
  { params }: { params: Params }
) => {
  const body = await request.json();
  console.log(body, params);

  return Response.json(
    {
      result: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              text: "Hello world",
            },
            {
              type: "text",
              text: "Link",
              href: "https://www.google.com",
            },
          ],
        },
        {
          type: "table",
          header: [
            {
              type: "text",
              text: "Name",
            },
            {
              type: "text",
              text: "Age",
            },
            {
              type: "text",
              text: "Gender",
            },
          ],
          rows: [
            [
              {
                type: "text",
                text: "John",
              },
              {
                type: "text",
                text: "25",
              },
              {
                type: "text",
                text: "Male",
              },
            ],
            [
              {
                type: "text",
                text: "Jane",
              },
              {
                type: "text",
                text: "30",
              },
              {
                type: "text",
                text: "Female",
              },
            ],
          ],
        },
      ],
    },
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
};

export const OPTIONS = async (
  request: NextRequest,
  { params }: { params: Params }
) => {
  return Response.json(
    {},
    {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
};
