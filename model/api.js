import { makeSendMsg, makeForwardMsg, msgToOneBotMsg } from './makeMsg.js'
import { getMsgMap, setMsgMap, getGuildLatestMsgId, getLatestMsg } from './msgMap.js'
import { MsgToCQ } from './CQCode.js'
import { Version } from '../components/index.js'
import fetch from 'node-fetch'

async function getApiData(api, params = {}, name, uin) {
    const bot = Version.isTrss ? Bot[uin] : Bot
    let sendRet = null
    let ResponseData = null
    let publicApi = {
        // --------------------------------------------------------
        // Bot 账号
        // 有关 Bot 账号的相关 API
        // --------------------------------------------------------

        // 获取登录号信息
        'get_login_info': async params => {
            ResponseData = {
                user_id: bot.uin,
                nickname: bot.nickname
            }
        },
        // 设置登录号资料  
        'set_qq_profile': async params => {
            // company公司 email邮箱 college学校 在icqq文档中没找到
            if (params.nickname) {
                await bot.setNickname?.(params.nickname)
            }
            if (params.personal_note) {
                await bot.setDescription?.(params.personal_note)
            }
        },
        // 获取企点账号信息
        // TODO qidian_get_account_info
        // 获取在线机型
        // TODO _get_model_show
        // 设置在线机型
        '_set_model_show': async params => {
            // TODO 不会改
        },
        // 获取当前账号在线客户端列表
        'get_online_clients': async params => {
            // TODO 不会获取
            ResponseData = {
                clients: []
            }
        },

        // --------------------------------------------------------
        // 好友信息
        // --------------------------------------------------------

        // 获取陌生人信息
        'get_stranger_info': async (params) => {
            ResponseData = await bot.getStrangerInfo?.(params.user_id)
        },
        // 获取好友列表
        'get_friend_list': async params => {
            let list = await bot.getFriendList?.()
            if (Array.isArray(list)) {
                ResponseData = list
            } else if (list instanceof Map) {
                ResponseData = Array.from(list.values())
            }
        },
        // 获取单向好友列表
        'get_unidirectional_friend_list': async params => {
            // 感觉不像这个
            // ResponseData = Array.from(bot.sl.values())
            ResponseData = []
        },

        // --------------------------------------------------------
        // 好友操作
        // 好友操作 API
        // --------------------------------------------------------

        // 删除好友
        'delete_friend': async params => {
            await bot.deleteFriend?.(params.user_id)
        },
        // 删除单向好友 
        // TODO delete_unidirectional_friend

        // --------------------------------------------------------
        // 消息
        // 有关消息操作的 API
        // --------------------------------------------------------

        // 发送私聊消息
        'send_private_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params, uin)
            if (sendMsg.length > 0) sendRet = await bot.pickFriend?.(params.user_id).sendMsg?.(sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送群聊消息
        'send_group_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params, uin)
            if (sendMsg.length > 0) sendRet = await bot.pickGroup?.(params.group_id).sendMsg?.(sendMsg, quote)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送消息
        'send_msg': async (params) => {
            let { sendMsg, quote } = await makeSendMsg(params, uin)
            if (params.message_type == 'group' || params.group_id) {
                if (sendMsg.length > 0) sendRet = await bot.pickGroup?.(params.group_id).sendMsg?.(sendMsg, quote)
            } else if (params.message_type == 'private' || params.user_id) {
                if (sendMsg.length > 0) sendRet = await bot.pickFriend?.(params.user_id).sendMsg?.(sendMsg, quote)
            }
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 获取消息
        'get_msg': async (params) => {
            ResponseData = await getMsgMap({ onebot_id: params.message_id })
            if (ResponseData) {
                ResponseData = await bot.getMsg?.(ResponseData.message_id)
                if (ResponseData) {
                    if (ResponseData.bot) delete ResponseData.bot
                    ResponseData.group = ResponseData.message_type == 'group' ? true : false
                    ResponseData.real_id = Number(ResponseData.seq)
                    ResponseData.message_id = Number(ResponseData.rand)
                    ResponseData.message = await msgToOneBotMsg(ResponseData.message)
                } else {
                    throw { message: 'get_msg API error', noLog: true }
                }
            } else {
                throw { message: 'get_msg API error', noLog: true }
            }
        },
        // 撤回消息
        'delete_msg': async (params) => {
            let msg = await getMsgMap({ onebot_id: params.message_id })
            if (msg) {
                await bot.deleteMsg?.(msg.message_id)
            }
        },
        // 标记消息已读
        'mark_msg_as_read': async params => {
            // TODO
        },
        // 获取合并转发内容
        'get_forward_msg': async params => {
            let result = await bot.getForwardMsg?.(params.message_id) || []
            let messages = []
            for (const item of result) {
                messages.push({
                    content: MsgToCQ(await msgToOneBotMsg(item.message)),
                    sender: {
                        nickname: item.nickname,
                        user_id: item.user_id
                    },
                    time: item.time
                })
            }
            ResponseData = {
                messages
            }
        },
        // 发送合并转发 ( 群聊 )
        'send_group_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params, uin)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await bot.pickGroup(params.group_id).sendMsg(forwardMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 发送合并转发 ( 好友 )
        'send_private_forward_msg': async (params) => {
            let forwardMsg = await makeForwardMsg(params, uin)
            let forward_id
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) forward_id = detail.resid
            } else {
                let match = forwardMsg.data.match(/m_resid="(.*?)"/);
                if (match) forward_id = match[1];
            }
            sendRet = await bot.pickFriend(params.group_id).sendMsg(forwardMsg)
            sendRet.forward_id = forward_id
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        // 获取群消息历史记录
        'get_group_msg_history': async params => {
            let messages, flag = true
            if (params.message_seq) {
                let message_id = (await getMsgMap({ onebot_id: params.message_id }))?.message_id
                if (message_id) {
                    messages = await bot.getChatHistory?.(message_id)
                    flag = false
                }
            }
            if (flag) {
                messages = await bot.pickGroup(params.group_id).getChatHistory?.()
            }
            if (messages) {
                for (let i = 0; i < messages.length; i++) {
                    messages[i] = await msgToOneBotMsg(messages[i])
                }
            }
            ResponseData = {
                messages
            }
        },

        // --------------------------------------------------------
        // 图片
        // 图片相关 API
        // --------------------------------------------------------

        // 获取图片信息
        // TODO get_image 不会
        // 检查是否可以发送图片
        // TODO can_send_image 不会
        // 图片 OCR
        // TODO ocr_image .ocr_image 没找到例子

        // --------------------------------------------------------
        // 语音
        // 语音相关 API
        // --------------------------------------------------------

        // 获取语音
        // TODO get_record
        // 检查是否可以发送语音
        // TODO can_send_record 不会

        // --------------------------------------------------------
        // 处理
        // 上报处理相关 API
        // --------------------------------------------------------

        // 处理加好友请求
        'set_friend_add_request': async params => {
            let ret = (await bot.getSystemMsg?.() || []).filter(i => i.request_type == 'friend' && i.flag == params.flag)
            if (ret.length > 0) {
                ret = ret[0]
                if (ret.approve(params.approve)) {
                    if (params.remark) {
                        bot.pickFriend(ret.user_id).setRemark(params.remark)
                    }
                }
            }
        },
        // 处理加群请求／邀请
        'set_group_add_request': async params => {
            let type = params.sub_type || params.type
            let ret = (await bot.getSystemMsg?.() || []).filter(i => i.request_type == 'group' && i.sub_type == type && i.flag == params.flag)
            if (ret.length > 0) {
                ret = ret[0]
                ret.approve(params.approve)
                // 不会写拒绝理由捏
            }
        },

        // --------------------------------------------------------
        // 群信息
        // 群信息相关 API
        // --------------------------------------------------------

        // 获取群信息
        'get_group_info': async params => {
            const group = await bot.pickGroup(params.group_id)
            ResponseData = group.info || group.info?.() || group.getInfo?.()
            if (ResponseData.group_name) {
                ResponseData.group_memo = ResponseData.group_name
            }
            if (ResponseData.create_time) {
                ResponseData.group_create_time = ResponseData.create_time
            }
            if (ResponseData.grade) {
                ResponseData.group_level = ResponseData.grade
            }
        },
        // 获取群列表
        'get_group_list': async params => {
            let list = await bot.getGroupList?.()
            if (list instanceof Map) {
                list = Array.from(list.values())
            }
            list.map(item => {
                if (item.group_name) {
                    item.group_memo = item.group_name
                }
                if (item.create_time) {
                    item.group_create_time = item.create_time
                }
                if (item.grade) {
                    item.group_level = item.grade
                }
            })
            ResponseData = list
        },
        // 获取群成员信息
        'get_group_member_info': async (params) => {
            const group = await bot.pickGroup(params.group_id).pickMember(params.user_id)
            ResponseData = group?.info || group.info?.() || group.getInfo?.() || await bot.getGroupMemberInfo?.(params.group_id, params.user_id);
            if (ResponseData.shutup_time) {
                ResponseData.shut_up_timestamp = ResponseData.shutup_time
            }
            if (!ResponseData.last_sent_time) {
                ResponseData.last_sent_time = Date.now()
            }
        },
        // 获取群成员列表
        'get_group_member_list': async (params) => {
            const group = await bot.pickGroup(params.group_id)
            let list = await group.getMemberMap?.() || await group.getMemberList?.() || []
            if (list instanceof Map) {
                list = Array.from(list.values())
            }
            list.map(item => {
                if (item.shutup_time) {
                    item.shut_up_timestamp = item.shutup_time
                }
                if (!item.last_sent_time) {
                    item.last_sent_time = Date.now()
                }
            })
            ResponseData = list
        },
        // 获取群荣誉信息
        // TODO get_group_honor_info
        // 获取群系统消息
        'get_group_system_msg': async params => {
            let invited_requests = []
            let join_requests = []
            for (const i of (await bot.getSystemMsg?.() || [])) {
                if (i.request_type == 'group') {
                    switch (i.sub_type) {
                        case 'add':
                            join_requests.push({
                                request_id: i.seq,
                                requester_uin: i.user_id,
                                requester_nick: i.nickname,
                                message: i.comment,
                                group_id: i.group_id,
                                group_name: i.group_name,
                                checked: false, //好像这个只能获取没处理的
                                actor: 0
                            })
                            break;
                        case 'invite':
                            invited_requests.push({
                                request_id: i.seq,
                                invitor_uin: i.user_id,
                                invitor_nick: i.nickname,
                                group_id: i.group_id,
                                group_name: i.group_name,
                                checked: false, //同上
                                actor: 0
                            })
                            break;
                        default:
                            break;
                    }
                }
            }
            ResponseData = {
                invited_requests,
                join_requests
            }
        },
        // 获取精华消息列表
        'get_essence_msg_list': async params => {
            ResponseData = []
            let is_end = false, page_start = 0, page_limit = 50
            while (!is_end && !Version.isTrss) {
                let res = await fetch(`https://qun.qq.com/cgi-bin/group_digest/digest_list?bkn=${bot.bkn}&group_code=${params.group_id}&page_start=${page_start}&page_limit=${page_limit}`, {
                    headers: {
                        Cookie: bot.cookies['qun.qq.com']
                    }
                }).then(r => r.json())
                if (res.retcode !== 0) return
                if (res.data?.is_end === false) {
                    page_start++
                } else if (res.data?.is_end === true) {
                    is_end = true
                }
                for (const i of res.data.msg_list) {
                    ResponseData.push({
                        sender_id: i.sender_uin,
                        sender_nick: i.sender_nick,
                        sender_time: i.sender_time,
                        operator_id: i.add_digest_uin,
                        operator_nick: i.add_digest_nick,
                        operator_time: add_digest_time,
                        message_id: i.msg_random
                    })
                }
            }
        },
        // 获取群 @全体成员 剩余次数
        'get_group_at_all_remain': async params => {
            let ret = await bot.pickGroup(params.group_id)
            ResponseData = {
                can_at_all: ret?.is_admin || false,
                // 群内所有管理当天剩余 @全体成员 次数 不会获取捏
                remain_at_all_count_for_group: ret.getAtAllRemainder?.() || 0,
                remain_at_all_count_for_uin: ret.getAtAllRemainder?.() || 0
            }
        },

        // --------------------------------------------------------
        // 群设置
        // 群设置相关 API
        // --------------------------------------------------------

        // 设置群名
        'set_group_name': async params => {
            await bot.setGroupName?.(params.group_id, params.group_name)
        },
        // 设置群头像
        'set_group_portrait': async params => {
            await bot.setGroupPortrait?.(params.group_id, params.file)
        },
        // 设置群管理员
        'set_group_admin': async params => {
            await bot.setGroupAdmin?.(params.group_id, params.user_id, params.enable)
        },
        // 设置群名片 ( 群备注 )
        'set_group_card': async params => {
            await bot.setGroupCard?.(params.group_id, params.user_id, params.card)
        },
        //设置群组专属头衔
        'set_group_special_title': async params => {
            await bot.setGroupSpecialTitle?.(params.group_id, params.user_id, params.special_title, params.duration || -1)
        },

        // --------------------------------------------------------
        // 群操作
        // 群操作相关 API
        // --------------------------------------------------------

        // 群单人禁言
        'set_group_ban': async (params) => {
            await bot.setGroupBan?.(params.group_id, params.user_id, params.duration)
        },
        // 群全员禁言
        'set_group_whole_ban': async params => {
            await bot.setGroupWholeBan?.(params.group_id, params.enable)
        },
        // 群匿名用户禁言
        'set_group_anonymous_ban': async params => {
            let flag = params.anonymous?.flag || params.anonymous_flag || params.flag
            await bot.setGroupAnonymousBan?.(params.group_id, flag, params.duration)
        },
        // 设置精华消息
        'set_essence_msg': async params => {
            let message_id = (await getMsgMap({ onebot_id: params.message_id }))?.message_id
            if (message_id) await bot.setEssenceMessage?.(message_id)
        },
        // 移出精华消息
        'delete_essence_msg': async params => {
            let message_id = (await getMsgMap({ onebot_id: params.message_id }))?.message_id
            if (message_id) await bot.removeEssenceMessage?.(message_id)
        },
        // 群打卡
        'send_group_sign': async params => {
            await bot.sendGroupSign?.(params.group_id)
        },
        // 群设置匿名
        'set_group_anonymous': async params => {
            await bot.setGroupAnonymous?.(params.group_id, params.enable)
        },
        // 发送群公告
        '_send_group_notice': async params => {
            // await bot.sendGroupNotice(params.group_id, params.content)
            if (!Version.isTrss) {
                await fetch(`https://web.qun.qq.com/cgi-bin/announce/add_qun_notice?bkn=${bot.bkn}`, {
                    method: 'POST',
                    body: `qid=${params.group_id}&bkn=${bot.bkn}&text=${params.content}&pinned=0&type=1&settings={"is_show_edit_card":1,"tip_window_type":1,"confirm_required":1}`,
                    headers: {
                        Cookie: bot.cookies['qun.qq.com']
                    }
                })
            }
        },
        // 获取群公告
        '_get_group_notice': async params => {
            if (!Version.isTrss) {
                let res = await fetch(`https://web.qun.qq.com/cgi-bin/announce/get_t_list?bkn=${bot.bkn}&qid=${params.group_id}&ft=23&s=-1&n=20`, {
                    headers: {
                        Cookie: bot.cookies['qun.qq.com']
                    }
                }).then(r => r.json())
                ResponseData = []
                if (res.feeds) {
                    for (const i of res.feeds) {
                        let item = {
                            sender_id: i.u,
                            publish_time: i.pubt,
                            message: {
                                text: i.msg.text
                            },
                            images: []
                        }
                        if (i.pics) {
                            for (const pic of i.pics) {
                                item.images.push({
                                    height: pic.h,
                                    width: pic.w,
                                    id: pic.id
                                })
                            }
                        }
                        ResponseData.push(item)
                    }
                }
            }
        },
        // 群组踢人
        'set_group_kick': async params => {
            await bot.setGroupKick?.(params.group_id, params.user_id, params.reject_add_request || false)
        },
        // 退出群组
        'set_group_leave': async params => {
            await bot.setGroupLeave?.(params.group_id)
        },

        // --------------------------------------------------------
        // 文件
        // --------------------------------------------------------

        // 上传群文件
        'upload_group_file': async params => {
            await bot.pickGroup(params.group_id).fs?.upload?.(params.file, params.folder || '/', params.name)
        },
        // 删除群文件
        'delete_group_file': async params => {
            await bot.pickGroup(params.group_id).fs?.rm?.(params.file_id)
        },
        // 创建群文件文件夹
        'create_group_file_folder': async params => {
            await bot.pickGroup(params.group_id).fs?.mkdir?.(params.name)
        },
        // 删除群文件文件夹
        'delete_group_folder': async params => {
            await bot.pickGroup(params.group_id).fs?.rm?.(params.folder_id)
        },
        // 获取群文件系统信息
        'get_group_file_system_info': async params => {
            let ret = await bot.pickGroup(params.group_id).fs?.df?.()
            ResponseData = {
                file_count: ret?.file_count || 0,
                limit_count: ret?.max_file_count || 0,
                used_space: ret?.used || 0,
                total_space: ret?.total || 0
            }
        },
        // 获取群根目录文件列表
        'get_group_root_files': async (params) => {
            let list = await bot.pickGroup(params.group_id).fs?.ls?.()
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        // 获取群子目录文件列表
        'get_group_files_by_folder': async params => {
            let list = await bot.pickGroup(params.group_id).fs?.ls?.(params.folder_id)
            let files = []
            let folders = []
            let nickname = {}
            if (Array.isArray(list) && list.length > 0) {
                for (const item of list) {
                    let user_id = item.user_id
                    if (!nickname[user_id]) {
                        nickname[user_id] = (await bot.getStrangerInfo(item.user_id)).nickname
                    }
                    if (item.is_dir) {
                        folders.push({
                            group_id: params.group_id,
                            folder_id: item.fid,
                            folder_name: item.name,
                            create_time: item.create_time,
                            creator: item.user_id,
                            creator_name: nickname[user_id],
                            total_file_count: item.file_count
                        })
                    } else {
                        files.push({
                            group_id: params.group_id,
                            file_id: item.fid,
                            file_name: item.name,
                            busid: item.busid,
                            file_size: item.size,
                            upload_time: item.create_time,
                            dead_time: item.duration,
                            modify_time: item.create_time,
                            download_times: item.download_times,
                            uploader: item.user_id,
                            uploader_name: nickname[user_id]
                        })
                    }
                }
            }
            ResponseData = {
                files,
                folders
            }
        },
        // 获取群文件资源链接
        'get_group_file_url': async params => {
            let file = await bot.pickGroup(params.group_id).fs?.download?.(params.file_id)
            ResponseData = {
                url: file?.url
            }
        },
        // 上传私聊文件
        'upload_private_file': async params => {
            await bot.pickFriend(params.user_id).sendFile?.(params.file, params.name)
        },

        // --------------------------------------------------------
        // Go-CqHttp 相关
        // 获取 Cookies
        // --------------------------------------------------------

        // 获取 Cookies
        'get_cookies': async params => {
            ResponseData = {
                cookies: await bot.getCookies?.(params.domain || null)
            }
        },
        // 获取 CSRF Token
        'get_csrf_token': async params => {
            ResponseData = {
                token: await bot.getCsrfToken?.()
            }
        },
        // 获取 QQ 相关接口凭证
        'get_credentials': async params => {
            ResponseData = {
                cookies: await bot.getCookies?.(params.domain || null),
                token: await bot.getCsrfToken?.()
            }
        },
        // 获取版本信息
        'get_version_info': async params => {
            ResponseData = {
                app_name: 'ws-plugin',
                app_version: Version.version,
                protocol_version: 'v11'
            }
        },
        // 获取状态
        'get_status': async params => {
            ResponseData = {
                online: bot.isOnline?.() || true,
                good: bot.isOnline?.() || true,
                app_initialized: true,
                app_enabled: true,
                plugins_good: true,
                app_good: true,
                stat: {
                    packet_receivend: bot.stat?.recv_pkt_cnt || 0,
                    packet_send: bot.stat?.sent_pkt_cnt || 0,
                    packet_lost: bot.stat?.lost_pkt_cnt || 0,
                    message_received: bot.stat?.recv_msg_cnt || 0,
                    message_send: bot.stat?.sent_msg_cnt || 0,
                    disconnect_times: 0,
                    lost_times: bot.stat?.lost_times || 0,
                    last_message_time: getLatestMsg()?.time || 0
                }
            }
        },
        // 重启 Go-CqHttp
        // set_restart 什么?已经没了? 
        // 清理缓存
        'clean_cache': async params => {
            await bot.cleanCache?.()
        },
        // 重载事件过滤器
        // TODO reload_event_filter 这是啥
        // 下载文件到缓存目录
        // TODO download_file 这又是啥
        // 检查链接安全性
        // TODO check_url_safely 不会
        // 获取中文分词 ( 隐藏 API )
        // .get_word_slices
        // 对事件执行快速操作 ( 隐藏 API )
        // .handle_quick_operation


        'send_guild_channel_msg': async params => {
            let { sendMsg } = await makeSendMsg(params, uin)
            sendMsg.unshift({
                type: 'reply',
                data: {
                    id: getGuildLatestMsgId()
                }
            })
            await bot.pickGroup?.(`qg_${params.guild_id}-${params.channel_id}`)?.sendMsg?.(sendMsg)
            logger.mark(`[ws-plugin] 连接名字:${name} 处理完成`)
        },
        'get_guild_service_profile': async params => {
            ResponseData = {
                avatar_url: bot.avatar,
                nickname: bot.nickname,
                tiny_id: bot.tiny_id
            }
        },
        'get_guild_list': async params => {
            ResponseData = await bot.getGuildList?.()
        },
        'get_guild_channel_list': async params => {

        },

    }
    if (typeof publicApi[api] === 'function') {
        await publicApi[api](params)
        if (sendRet) {
            const onebot_id = Math.floor(Math.random() * Math.pow(2, 32)) | 0
            ResponseData = {
                ...sendRet,
                message_id: onebot_id,
            }
            setMsgMap({
                message_id: sendRet.message_id,
                time: sendRet.time,
                seq: sendRet.seq,
                rand: sendRet.rand,
                user_id: params.user_id,
                group_id: params.group_id,
                onebot_id,
            })
        }
        return ResponseData
    } else {
        logger.warn(`未适配的api: ${api}`);
    }
}

export {
    getApiData
}