import {ok, err, catchErr} from '@/lib/apiResponse';
import {employeeService} from '@/services';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  if (searchParams.has('id')) {
    try {
      return ok(await employeeService.getById(searchParams.get('id')!));
    } catch (e) {
      const s = (e as {status?: number}).status;
      return s === 404 ? err('Employee not found', 404) : catchErr(e);
    }
  }
  return ok(await employeeService.getAll());
}

export async function POST(request: Request) {
  try {
    return ok(await employeeService.create(await request.json()), 201);
  } catch (e) {
    const s = (e as {status?: number}).status;
    return s === 400 ? err(e instanceof Error ? e.message : 'Bad request', 400) : catchErr(e);
  }
}

export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return err('Missing id', 400);
  try {
    return ok(await employeeService.update(id, await request.json()));
  } catch (e) {
    const s = (e as {status?: number}).status;
    return s === 400 ? err(e instanceof Error ? e.message : 'Bad request', 400) : catchErr(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const {id} = await request.json();
    if (!id) return err('Missing id', 400);
    return ok(await employeeService.remove(id));
  } catch (e) {
    return catchErr(e);
  }
}
