import { config } from './config.js';
import { initialTasks } from './tasks.js';

const $ = id => document.getElementById(id);
const demo = !config.url && !config.publishableKey;
let api, user, mentor = false, rosterMissing = false, week = 1, lesson = 1;
let tasks = demo ? [...initialTasks] : [];
let submissions = [];
let details = new Map();
let viewRequest = 0;
const samples = new Map();
const mimeTypes = ['application/pdf','image/jpeg','image/png'];
const dateFormat = new Intl.DateTimeFormat('az-AZ', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Baku'
});

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, handler, className) {
  const node = element('button', text, className);
  node.type = 'button';
  node.addEventListener('click', handler);
  return node;
}

function show(title, content, className = '') {
  $('modal-title').textContent = title;
  $('modal-body').replaceChildren(content);
  $('modal').className = className;
  if (!$('modal').open) $('modal').showModal();
}

function field(label, name, type = 'text', options = {}) {
  const wrapper = element('label', label);
  const input = element(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.name = name;
  Object.assign(input, options);
  wrapper.append(input);
  return wrapper;
}

function form(fields, action, onSubmit) {
  const node = element('form');
  const submit = element('button', action);
  const status = element('p', '', 'form-error');
  status.setAttribute('role','alert');
  node.append(...fields, submit, status);
  node.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled) return;
    submit.disabled = true;
    status.textContent = '';
    try {
      await onSubmit(new FormData(node));
      if (node.isConnected) $('modal').close();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Əməliyyat alınmadı. Yenidən cəhd et.';
    } finally {
      submit.disabled = false;
    }
  };
  return node;
}

function check(result, message) {
  if (result.error) throw new Error(message);
  return result.data;
}

async function refresh() {
  const request = ++viewRequest;
  if (api) {
    const member = user && !rosterMissing;
    const [detailResult, taskResult, submissionResult] = await Promise.all([
      api.from('site_details').select('*'),
      member ? api.from('tasks').select('*').order('created_at').order('id') : null,
      member ? api.from('submissions').select('*').order('submitted_at', { ascending: false }) : null
    ]);
    if (request !== viewRequest) return;
    const rows = check(detailResult, 'Portal məlumatlarını yükləmək mümkün olmadı.');
    tasks = member ? check(taskResult, 'Tapşırıqları yükləmək mümkün olmadı.') : [];
    submissions = member ? check(submissionResult, 'Təqdimatları yükləmək mümkün olmadı.') : [];
    details = new Map(rows.map(row => [row.section, row]));
  }
  render();
}

function updateView() {
  refresh().catch(error => { $('notice').textContent = error.message; });
}

async function loadAccount(sessionUser) {
  ++viewRequest;
  user = sessionUser;
  tasks = [];
  submissions = [];
  details.clear();
  mentor = false;
  rosterMissing = false;
  if (sessionUser) {
    const member = check(await api.from('members').select('role').eq('id', sessionUser.id).maybeSingle(), 'Hesaba giriş yoxlanmadı.');
    if (user !== sessionUser) return;
    mentor = member?.role === 'mentor';
    rosterMissing = !member;
  }
  await refresh();
}

function studentSubmission(taskId) {
  return submissions.find(row => row.task_id === taskId && row.student_id === (demo ? 'student-demo' : user?.id));
}

function lessonDetails(weekNumber, lessonNumber) {
  const section = 'lesson-' + weekNumber + '-' + lessonNumber;
  const first = weekNumber === 1 && lessonNumber === 1;
  return {
    section,
    title: first ? 'Kibertəhlükəsizliyə giriş' : 'Dərs ' + lessonNumber,
    description: first ? 'İlk dərsin slaydlarına bax və mövzunu iki tapşırıqla möhkəmləndir.' : '',
    material_title: '', material_url: '', material_hidden: false,
    ...details.get(section)
  };
}

function materialUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch {
    return '';
  }
}

function render() {
  $('account').textContent = demo ? (mentor ? 'Şagird görünüşü' : 'Mentor görünüşü') : (user ? 'Çıxış' : 'Daxil ol');
  $('notice').textContent = demo
    ? 'Sınaq rejimi · Məlumatlar bu səhifə yenilənənədək saxlanılır. Yalnız nümunə məlumatlardan istifadə et.'
    : rosterMissing ? 'Bu hesab proqram siyahısında yoxdur. Mentorla əlaqə saxla.'
    : !user ? 'Tapşırıqları görmək və işini göndərmək üçün daxil ol.' : user.email;
  const portal = details.get('portal') || { title: 'Təcrübə portalı', subtitle: 'Kibertəhlükəsizlik' };
  $('portal-name').textContent = portal.title;
  $('program-name').textContent = portal.subtitle;
  document.title = [portal.subtitle, portal.title].filter(Boolean).join(' · ');
  const info = lessonDetails(week, lesson);
  const external = info.material_hidden ? '' : materialUrl(info.material_url);
  const slides = !info.material_hidden && !external && week === 1 && lesson === 1;
  const hasMaterial = Boolean(external || slides);
  const lessonTasks = (weekNumber, lessonNumber) =>
    tasks.filter(task => task.week === weekNumber && task.lesson === lessonNumber);
  const current = lessonTasks(week, lesson);
  const select = (weekNumber, lessonNumber, focusId) => {
    week = weekNumber;
    lesson = lessonNumber;
    render();
    $(focusId)?.focus();
  };
  $('weeks').replaceChildren(...Array.from({ length: 6 }, (_, index) => {
    const number = index + 1;
    const id = 'week-' + number;
    const item = button(null, () => {
      if (week !== number) select(number, 1, id);
    }, 'week');
    item.id = id;
    item.setAttribute('aria-current', String(week === number));
    item.append(element('span', details.get(id)?.title || 'Həftə ' + number));
    const label = details.has(id) ? 'Həftə ' + number : '2 dərs';
    item.append(element('small', label));
    return item;
  }));
  $('lessons').replaceChildren(...[1, 2].map(number => {
    const id = 'lesson-' + number;
    const item = button(null, () => {
      if (lesson !== number) select(week, number, id);
    }, 'lesson-choice');
    item.id = id;
    item.setAttribute('aria-current', String(lesson === number));
    const lessonInfo = lessonDetails(week, number);
    item.append(element('span', lessonInfo.title));
    const count = lessonTasks(week, number).length;
    if (count) item.append(element('small', count + ' tapşırıq'));
    else if (!lessonInfo.material_hidden && (materialUrl(lessonInfo.material_url) || (week === 1 && number === 1))) {
      item.append(element('small', 'Material'));
    }
    return item;
  }));
  $('breadcrumb').textContent = 'Həftə ' + week + ' / Dərs ' + lesson;
  $('week-label').textContent = 'HƏFTƏ ' + week + ' · DƏRS ' + lesson;
  $('heading').textContent = info.title;
  $('intro').textContent = info.description;
  $('intro').hidden = !info.description;
  $('resource').hidden = !hasMaterial;
  $('material-title').textContent = info.material_title || (slides ? 'İnteraktiv slaydlar' : 'Dərs materialı');
  $('material-meta').textContent = slides ? '32 slayd' : 'Xarici keçid';
  $('open-lesson').hidden = !slides;
  $('material-link').hidden = !external;
  if (external) $('material-link').href = external;
  else $('material-link').removeAttribute('href');
  $('no-material').hidden = hasMaterial;
  $('editor').hidden = !mentor;
  const completed = current.filter(task => studentSubmission(task.id)).length;
  $('progress-panel').hidden = mentor || !current.length;
  $('progress').textContent = completed + ' / ' + current.length + ' təqdim edilib';
  $('meter').max = current.length || 1;
  $('meter').value = completed;
  $('tasks').replaceChildren(...(current.length ? current.map(taskCard) : [
    element('p', !demo && !user ? 'Tapşırıqlar girişdən sonra görünür.' : 'Bu dərs üçün tapşırıq hələ paylaşılmayıb.', 'empty')
  ]));
  $('mentor').hidden = !mentor;
  $('new-task').hidden = !mentor;
  if (mentor) {
    const rows = submissions.filter(row => current.some(task => task.id === row.task_id));
    $('review-count').textContent = rows.length ? rows.length + ' təqdimat' : '';
    $('submissions').replaceChildren(...(rows.length ? rows.map(reviewCard) : [
      element('p', 'Bu dərs üzrə təqdim olunan iş yoxdur.', 'empty')
    ]));
  } else {
    $('submissions').replaceChildren();
  }
}

function taskCard(task) {
  const card = element('article', null, 'card');
  card.append(element('h3', task.title), element('p', task.instructions));
  const row = studentSubmission(task.id);
  if (row && !mentor) {
    card.append(element('span', 'Təqdim edilib · ' + dateFormat.format(new Date(row.submitted_at)), 'tag'));
    if (row.answer) card.append(element('p', row.answer));
    if (row.file_name) card.append(attachmentButton(row));
    if (row.feedback) card.append(element('strong', 'Mentor rəyi'), element('p', row.feedback));
  } else if (mentor) {
    card.append(button('Redaktə et', () => taskEditor(task), 'quiet'));
  } else if (demo || user) {
    card.append(button('Cavab göndər', () => submitTask(task)));
  }
  return card;
}

function submitTask(task) {
  show(task.title, form([
    field('Cavab', 'answer', 'textarea', { maxLength: 6000 }),
    field('Fayl · PDF, JPG və PNG · maksimum 10 MB', 'file', 'file', { accept: mimeTypes.join(',') })
  ], 'Təqdim et', async data => {
    const answer = data.get('answer').trim();
    const file = data.get('file');
    if (!answer && !file.size) throw new Error('Cavab yaz və ya fayl seç.');
    if (file.size && (!mimeTypes.includes(file.type) || file.size > 10 * 1024 * 1024 || file.name.length > 255)) {
      throw new Error('PDF, JPG və ya PNG seç. Faylın ölçüsü 10 MB-dan çox olmamalıdır.');
    }
    const id = crypto.randomUUID();
    const studentId = demo ? 'student-demo' : user.id;
    const path = file.size ? studentId + '/' + id : null;
    const row = { id, task_id: task.id, student_id: studentId, answer, file_path: path, file_name: path ? file.name : null };
    if (demo) {
      if (studentSubmission(task.id)) throw new Error('Bu tapşırıq artıq təqdim edilib.');
      if (path) samples.set(path, file);
      submissions.unshift({ ...row, student_email: 'numune@example.com', submitted_at: new Date().toISOString() });
    } else {
      if (path) check(await api.storage.from('internship-files').upload(path, file), 'Fayl yüklənmədi.');
      const result = await api.from('submissions').insert(row).select().single();
      if (result.error) {
        // A timed-out request may have committed. The storage policy protects referenced files.
        if (path) await api.storage.from('internship-files').remove([path]);
        updateView();
        throw new Error('Təqdimatı təsdiqləmək mümkün olmadı. Əvvəlcə tapşırığın vəziyyətini yoxla.');
      }
      submissions = [result.data, ...submissions.filter(item => item.id !== id)];
    }
    render();
  }));
}

function attachmentButton(row) {
  const node = button('Faylı endir · ' + row.file_name, async () => {
    node.disabled = true;
    try {
      const file = demo ? samples.get(row.file_path) : check(
        await api.storage.from('internship-files').download(row.file_path), 'Faylı endirmək mümkün olmadı.'
      );
      const href = URL.createObjectURL(file);
      const link = element('a');
      link.href = href;
      link.download = row.file_name;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(href), 30000);
    } catch {
      $('notice').textContent = 'Faylı endirmək mümkün olmadı.';
    } finally {
      node.disabled = false;
    }
  }, 'quiet');
  return node;
}

function reviewCard(row) {
  const card = element('article', null, 'card');
  card.append(
    element('h3', tasks.find(task => task.id === row.task_id).title),
    element('p', row.student_email + ' · ' + dateFormat.format(new Date(row.submitted_at))),
    element('p', row.answer || 'Fayl əlavə olunub.')
  );
  if (row.file_name) card.append(attachmentButton(row));
  if (row.feedback) card.append(element('strong', 'Mentor rəyi'), element('p', row.feedback));
  card.append(button(row.feedback ? 'Rəyi redaktə et' : 'Rəy yaz', () => {
    show('Mentor rəyi', form([
      field('Rəy', 'feedback', 'textarea', { value: row.feedback || '', required: true, maxLength: 4000 })
    ], 'Rəyi saxla', async data => {
      const feedback = data.get('feedback').trim();
      if (!feedback) throw new Error('Rəy yaz.');
      if (api) check(await api.rpc('review_submission', { submission_id: row.id, note: feedback }), 'Rəy saxlanmadı.');
      row.feedback = feedback;
      render();
    }));
  }));
  return card;
}

function saveDetails(section, fields) {
  return async data => {
    const row = { section };
    for (const name of fields) row[name] = data.get(name).trim();
    if (!row.title) throw new Error('Adı daxil et.');
    if (fields.includes('material_url')) {
      row.material_hidden = data.get('material_hidden') === 'on';
      if (row.material_url && !materialUrl(row.material_url)) {
        throw new Error('Material üçün düzgün HTTPS keçidi daxil et.');
      }
    }
    if (api) {
      check(await api.from('site_details').upsert(row).select().single(), 'Dəyişikliklər saxlanmadı.');
    }
    ++viewRequest;
    details.set(section, row);
    render();
  };
}

function titleField(label, value) {
  return field(label, 'title', 'text', { value, required: true, maxLength: 120 });
}

$('edit-portal').onclick = () => {
  const portal = details.get('portal') || { title: 'Təcrübə portalı', subtitle: 'Kibertəhlükəsizlik' };
  show('Portal ayarları', form([
    titleField('Portalın adı', portal.title),
    field('Proqramın adı', 'subtitle', 'text', { value: portal.subtitle, maxLength: 120 })
  ], 'Saxla', saveDetails('portal', ['title', 'subtitle'])));
};

$('edit-week').onclick = () => {
  const section = 'week-' + week;
  show('Həftə ' + week + ' · Redaktə', form([
    titleField('Həftənin adı', details.get(section)?.title || 'Həftə ' + week)
  ], 'Saxla', saveDetails(section, ['title'])));
};

$('edit-lesson').onclick = () => {
  const info = lessonDetails(week, lesson);
  const hideMaterial = field('Materialı gizlət', 'material_hidden', 'checkbox', { checked: info.material_hidden });
  hideMaterial.className = 'checkbox';
  show('Həftə ' + week + ' · Dərs ' + lesson + ' · Redaktə', form([
    titleField('Dərsin adı', info.title),
    field('Dərsin təsviri', 'description', 'textarea', { value: info.description, maxLength: 2400 }),
    field('Materialın adı', 'material_title', 'text', { value: info.material_title, maxLength: 120 }),
    field('Materialın HTTPS keçidi', 'material_url', 'url', { value: info.material_url, maxLength: 2000 }),
    hideMaterial
  ], 'Saxla', saveDetails(info.section, ['title', 'description', 'material_title', 'material_url'])));
};

function taskEditor(existing) {
  const selectedWeek = week;
  const selectedLesson = lesson;
  const action = existing ? 'Tapşırığı redaktə et' : 'Yeni tapşırıq';
  show('Həftə ' + selectedWeek + ' · Dərs ' + selectedLesson + ' · ' + action, form([
    titleField('Başlıq', existing?.title || ''),
    field('Təlimat', 'instructions', 'textarea', { value: existing?.instructions || '', required: true, maxLength: 4000 })
  ], existing ? 'Saxla' : 'Paylaş', async data => {
    const title = data.get('title').trim();
    const instructions = data.get('instructions').trim();
    if (!title || !instructions) throw new Error('Başlıq və təlimatı doldur.');
    if (existing) {
      const changes = { title, instructions };
      if (api) check(await api.from('tasks').update(changes).eq('id', existing.id).select().single(), 'Tapşırıq yenilənmədi.');
      ++viewRequest;
      tasks = tasks.map(task => task.id === existing.id ? { ...task, ...changes } : task);
    } else {
      const task = { id: crypto.randomUUID(), week: selectedWeek, lesson: selectedLesson, title, instructions };
      if (api) check(await api.from('tasks').insert(task), 'Tapşırıq paylaşılmadı.');
      ++viewRequest;
      tasks.push(task);
    }
    render();
  }));
}

$('new-task').onclick = () => taskEditor();
$('account').onclick = async () => {
  if (demo) {
    mentor = !mentor;
    render();
  } else if (user) {
    try {
      check(await api.auth.signOut(), 'Hesabdan çıxmaq mümkün olmadı.');
      await loadAccount(null);
    } catch (error) {
      $('notice').textContent = error.message;
    }
  } else if (api) {
    show('Portala daxil ol', form([
      field('E-poçt', 'email', 'email', { required: true, autocomplete: 'username' }),
      field('Parol', 'password', 'password', { required: true, autocomplete: 'current-password' })
    ], 'Daxil ol', async data => {
      const result = check(await api.auth.signInWithPassword({
        email: data.get('email').trim(), password: data.get('password')
      }), 'Giriş alınmadı. E-poçt və parolu yoxla.');
      await loadAccount(result.user);
    }));
  }
};

$('open-lesson').onclick = () => {
  const frame = element('iframe');
  const info = lessonDetails(week, lesson);
  frame.title = info.material_title || info.title;
  frame.setAttribute('sandbox', 'allow-scripts allow-presentation');
  frame.setAttribute('allowfullscreen', '');
  frame.src = './materials/day-01.html';
  show(frame.title, frame, 'lesson');
};
$('close').onclick = () => $('modal').close();
$('modal').addEventListener('close', () => $('modal-body').replaceChildren());
render();
if (!demo) {
  try {
    $('account').disabled = true;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.93.3/+esm');
    api = createClient(config.url, config.publishableKey);
    const { session } = check(await api.auth.getSession(), 'Giriş vəziyyəti yoxlanmadı.');
    await loadAccount(session?.user || null);
    window.addEventListener('focus', updateView);
  } catch {
    $('notice').textContent = 'Portalın bağlantısı qurulmadı. Mentorla əlaqə saxla.';
  } finally {
    $('account').disabled = false;
  }
}
