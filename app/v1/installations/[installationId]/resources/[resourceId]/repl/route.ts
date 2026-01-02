import { withAuth } from "@/lib/vercel/auth";

interface Params {
  installationId: string;
  resourceId: string;
}

interface PostResourceREPLRequestBody {
  input: string;
  readOnly?: boolean;
}

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

// https://developer.mozilla.org/docs/Web/API/ReadableStream#convert_async_iterator_to_stream
const iteratorToStream = (iterator: AsyncIterator<unknown>) =>
  new ReadableStream({
    async pull(controller) {
      const { value, done } = await iterator.next();

      if (done) {
        controller.close();
      } else {
        controller.enqueue(value);
      }
    },
  });

const sleep = (time: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, time);
  });

const encoder = new TextEncoder();

async function* makeIterator() {
  yield encoder.encode(
    JSON.stringify({
      type: "paragraph",
      children: [
        {
          type: "text",
          bold: true,
          text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
        },
      ],
    })
  );
  await sleep(1000);
  yield encoder.encode(
    JSON.stringify({
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?",
          italic: true,
        },
      ],
    })
  );
  await sleep(1000);
  yield encoder.encode(
    JSON.stringify({
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?",
        },
      ],
    })
  );
  await sleep(1000);
  yield encoder.encode(
    JSON.stringify({
      type: "paragraph",
      children: [
        {
          type: "text",
          text: "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat.",
        },
      ],
    })
  );
}

/**
 * Create a new resource REPL
 */
export const POST = withAuth(async (_claims, request) => {
  const body: PostResourceREPLRequestBody = await request.json();

  if (body.input.includes("throw")) {
    return Response.json(
      {},
      {
        status: 500,
      }
    );
  }

  if (body.readOnly && body.input.includes("write")) {
    return Response.json(
      [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              bold: true,
              text: "You don't have permission to write to this resource",
              color: "#ff0000",
            },
          ],
        },
      ] satisfies Block[],
      {
        status: 200,
      }
    );
  }

  if (body.input.includes("error")) {
    return Response.json(
      [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              bold: true,
              text: "Invalid command 'error'",
              color: "#ff0000",
            },
          ],
        },
      ] satisfies Block[],
      {
        status: 400,
      }
    );
  }

  if (body.input.includes("table")) {
    return Response.json(
      [
        {
          type: "table",
          header: [
            {
              type: "text",
              text: "Name",
              bold: true,
            },
            {
              type: "text",
              text: "Age",
              bold: true,
            },
            {
              type: "text",
              text: "Gender",
              bold: true,
            },
            {
              type: "text",
              text: "Gender",
              bold: true,
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
              {
                type: "text",
                text: "Gender",
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
              {
                type: "text",
                text: "Gender",
              },
            ],
          ],
        },
      ] satisfies Block[],
      {
        status: 200,
      }
    );
  }

  if (body.input.includes("stream")) {
    const iterator = makeIterator();
    const stream = iteratorToStream(iterator);

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/jsonl",
      },
    });
  }

  if (body.input.includes("help")) {
    return Response.json(
      [
        {
          type: "paragraph",
          children: [
            {
              color: "#a3f04b",
              type: "text",
              bold: true,
              text: "test:",
            },
            {
              type: "text",
              text: "renders a paragraph with a link",
              italic: true,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              color: "#a3f04b",
              type: "text",
              bold: true,
              text: "table:",
            },
            {
              type: "text",
              text: "renders a sample table",
              italic: true,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              color: "#a3f04b",
              bold: true,
              text: "error:",
            },
            {
              type: "text",
              text: "returns a 400 error with a message",
              italic: true,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              color: "#a3f04b",
              type: "text",
              bold: true,
              text: "throw:",
            },
            {
              type: "text",
              text: "returns a 500 error without a message",
              italic: true,
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              color: "#a3f04b",
              type: "text",
              text: "stream:",
            },
            {
              type: "text",
              text: "streams some text",
              italic: true,
            },
          ],
        },
      ] satisfies Block[],
      {
        status: 200,
      }
    );
  }

  return Response.json(
    [
      {
        type: "paragraph",
        children: [
          {
            type: "text",
            bold: true,
            text: "Hello",
          },
          {
            type: "text",
            text: "World",
            italic: true,
            color: "#a3f04b",
          },
          {
            type: "text",
            text: "Link",
            href: "https://www.vercel.com",
          },
        ],
      },
    ] satisfies Block[],
    {
      status: 200,
    }
  );
});
