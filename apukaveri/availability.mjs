/* RUN-004: wall-clock schedule model for the local demo.
 * Production must resolve Helsinki local times to UTC, handle DST, and reserve atomically.
 * A date override replaces the complete weekly schedule for that date.
 * No overnight intervals: split them at midnight. Half-open [start,end) intervals.
 */
export function validDate(s){
  if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;
  const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
export function minutes(s,allowEnd=false){
  if(allowEnd&&s==='24:00')return 1440;
  if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))return null;
  const [h,m]=s.split(':').map(Number);return h*60+m;
}
export function normalizeIntervals(intervals){
  if(!Array.isArray(intervals))throw Error('Invalid intervals');
  const rows=intervals.map(x=>{const a=minutes(x.start),b=minutes(x.end,true);if(a===null||b===null||a>=b)throw Error('Invalid interval');return [a,b]}).sort((a,b)=>a[0]-b[0]);
  const out=[];for(const row of rows){const last=out[out.length-1];if(last&&row[0]<=last[1])last[1]=Math.max(last[1],row[1]);else out.push(row.slice())}return out;
}
export function intervalsForDate(schedule,date){
  if(!validDate(date))throw Error('Invalid date');
  const day=new Date(date+'T00:00:00Z').getUTCDay();
  const override=schedule.overrides||{};
  return normalizeIntervals(Object.prototype.hasOwnProperty.call(override,date)?override[date]:(schedule.weekly||{})[day]||[]);
}
export function isAvailable(schedule,date,start,end,bookings=[]){
  if(!validDate(date))return false;
  const a=minutes(start),b=minutes(end,true);if(a===null||b===null||a>=b)return false;
  if(!intervalsForDate(schedule,date).some(x=>x[0]<=a&&b<=x[1]))return false;
  return !bookings.some(x=>{
    if(x.date!==date||x.cancelled===true)return false;
    const c=minutes(x.start),d=minutes(x.end,true);
    return c!==null&&d!==null&&c<b&&a<d;
  });
}
