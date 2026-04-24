import {ok, err, catchErr} from '@/lib/apiResponse';
import {companyService} from '@/services';

export async function GET(request: Request) {
  const {searchParams} = new URL(request.url);
  if (searchParams.has('id')) {
    try {
      return ok(await companyService.getById(searchParams.get('id')!));
    } catch (e) {
      const s = (e as {status?: number}).status;
      return s === 404 ? err('Company not found', 404) : catchErr(e);
    }
  }
  return ok(await companyService.getAll());
}

export async function POST(request: Request) {
  try {
    return ok(await companyService.create(await request.json()), 201);
  } catch (e) {
    const s = (e as {status?: number}).status;
    return s === 400 ? err(e instanceof Error ? e.message : 'Bad request', 400) : catchErr(e);
  }
}

export async function PATCH(request: Request) {
  try {
    return ok(await companyService.update(await request.json()));
  } catch (e) {
    const s = (e as {status?: number}).status;
    return s === 400 ? err(e instanceof Error ? e.message : 'Bad request', 400) : catchErr(e);
  }
}

export async function DELETE(request: Request) {
  try {
    const {id} = await request.json();
    if (!id) return err('Missing id', 400);
    return ok(await companyService.remove(id));
  } catch (e) {
    return catchErr(e);
  }
}
