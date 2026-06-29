import {ok, err, catchErr} from '@/lib/apiResponse';
import {userService} from '@/services';

export async function PUT(request: Request) {
  try {
    return ok(await userService.setActiveCompany(await request.json()));
  } catch (e) {
    const s = (e as {status?: number}).status;
    if (s === 400) return err(e instanceof Error ? e.message : 'Bad request', 400);
    if (s === 403) return err(e instanceof Error ? e.message : 'Forbidden', 403);
    if (s === 404) return err(e instanceof Error ? e.message : 'Not found', 404);
    return catchErr(e);
  }
}